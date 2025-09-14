import cron from 'node-cron';
import Database from './database.js';

class NotificationService {
  constructor(bot) {
    this.bot = bot;
    this.db = new Database();
    this.setupCronJobs();
  }

  setupCronJobs() {
    // Проверка уведомлений каждый час с 18:00 до 22:00
    cron.schedule('0 18-22 * * *', () => {
      this.checkAndSendNotifications();
    });

    // Также проверяем в 20:00 основное уведомление
    const notificationHour = process.env.NOTIFICATION_HOUR || 20;
    const notificationMinute = process.env.NOTIFICATION_MINUTE || 0;
    
    cron.schedule(`${notificationMinute} ${notificationHour} * * *`, () => {
      this.sendDailyReminders();
    });

    console.log('📅 Система уведомлений запущена');
  }

  async checkAndSendNotifications() {
    try {
      // Получаем пользователей, которым нужно отправить уведомление
      const users = await this.db.getUsersNeedingNotification(0.8);
      
      for (const user of users) {
        const percentage = Math.round((user.today_calories / user.daily_limit) * 100);
        const remaining = user.daily_limit - user.today_calories;
        
        let notificationMessage = '';
        let emoji = '';
        
        if (percentage >= 95) {
          emoji = '🚨';
          notificationMessage = `${emoji} Внимание! Вы почти достигли дневного лимита!\n\n`;
        } else if (percentage >= 85) {
          emoji = '⚠️';
          notificationMessage = `${emoji} Осторожно! Приближаетесь к дневному лимиту.\n\n`;
        } else if (percentage >= 75) {
          emoji = '🔶';
          notificationMessage = `${emoji} Напоминание о контроле калорий.\n\n`;
        }
        
        notificationMessage += `📊 Потреблено: ${user.today_calories} из ${user.daily_limit} ккал (${percentage}%)\n`;
        notificationMessage += `🎯 Осталось: ${remaining} ккал\n\n`;
        
        if (percentage >= 90) {
          notificationMessage += '💡 Рекомендация: возможно, стоит ограничить дальнейшее потребление на сегодня.';
        } else {
          notificationMessage += '💡 Рекомендация: старайтесь не превышать лимит до конца дня.';
        }

        await this.bot.sendMessage(user.chat_id, notificationMessage);
        await this.db.updateNotificationSent(user.chat_id);
        
        console.log(`📢 Отправлено уведомление пользователю ${user.chat_id}: ${percentage}%`);
      }
      
      if (users.length > 0) {
        console.log(`📢 Отправлено ${users.length} уведомлений`);
      }
    } catch (error) {
      console.error('Ошибка при отправке уведомлений:', error);
    }
  }

  async sendDailyReminders() {
    try {
      // Ежедневное напоминание в 20:00 для всех пользователей с целью похудения
      const users = await this.db.all(`
        SELECT u.chat_id, u.daily_goal, u.daily_limit,
               COALESCE(SUM(ce.calories), 0) as today_calories
        FROM users u
        LEFT JOIN calorie_entries ce ON u.chat_id = ce.chat_id 
          AND ce.entry_date = date('now')
        JOIN notification_settings ns ON u.chat_id = ns.chat_id
        WHERE u.goal_type = 'lose' 
        AND ns.enabled = 1
        GROUP BY u.chat_id
        HAVING today_calories < (u.daily_limit * 0.7)
      `);

      for (const user of users) {
        const percentage = Math.round((user.today_calories / user.daily_goal) * 100);
        const remaining = user.daily_goal - user.today_calories;
        
        if (remaining > 200) { // Если еще много калорий осталось
          const reminderMessage = `
🌅 Ежедневное напоминание!

📊 За сегодня: ${user.today_calories} ккал (${percentage}% от цели)
🎯 Цель: ${user.daily_goal} ккал
📈 Осталось: ${remaining} ккал

💡 Не забывайте добавлять все приемы пищи для точного подсчета!
          `;
          
          await this.bot.sendMessage(user.chat_id, reminderMessage.trim());
        }
      }

      console.log(`📅 Отправлены ежедневные напоминания ${users.length} пользователям`);
    } catch (error) {
      console.error('Ошибка при отправке ежедневных напоминаний:', error);
    }
  }

  // Мгновенная проверка при добавлении калорий
  async checkImmediateNotification(chatId, newCalories) {
    try {
      const user = await this.db.getUser(chatId);
      if (!user || user.goal_type !== 'lose') return;

      const todayTotal = await this.db.getTodayCalories(chatId);
      const percentage = (todayTotal / user.daily_limit) * 100;
      
      // Проверяем критические пороги
      if (percentage >= 100) {
        await this.bot.sendMessage(chatId, 
          '🚨 Вы превысили дневной лимит калорий!\n\n' +
          '💡 Рекомендуем прекратить прием пищи на сегодня и увеличить физическую активность.'
        );
      } else if (percentage >= 90 && (todayTotal - newCalories) / user.daily_limit < 0.9) {
        // Отправляем только если до добавления не было 90%
        await this.bot.sendMessage(chatId, 
          '⚠️ Внимание! Вы приближаетесь к дневному лимиту!\n\n' +
          `Осталось всего ${user.daily_limit - todayTotal} ккал до лимита.`
        );
      }
    } catch (error) {
      console.error('Ошибка мгновенного уведомления:', error);
    }
  }

  // Метод для ручного тестирования уведомлений
  async testNotification(chatId) {
    try {
      const user = await this.db.getUser(chatId);
      if (!user) {
        await this.bot.sendMessage(chatId, '❌ Пользователь не найден');
        return;
      }

      const todayTotal = await this.db.getTodayCalories(chatId);
      const percentage = Math.round((todayTotal / user.daily_limit) * 100);
      
      const testMessage = `
🧪 Тестовое уведомление:

📊 Текущее потребление: ${todayTotal} ккал
🎯 Цель: ${user.daily_goal} ккал  
⚠️ Лимит: ${user.daily_limit} ккал
📈 Процент от лимита: ${percentage}%

${percentage >= 80 ? '🔔 Уведомления активны' : '🔕 Пороговое значение не достигнуто'}
      `;

      await this.bot.sendMessage(chatId, testMessage.trim());
    } catch (error) {
      console.error('Ошибка тестового уведомления:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при тестировании');
    }
  }
}

export default NotificationService;

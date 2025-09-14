import Database from './database.js';

class CommandHandler {
  constructor(bot) {
    this.bot = bot;
    this.db = new Database();
    this.userStates = new Map(); // Для хранения состояний пользователей
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;

    await this.db.createUser(chatId, username, firstName);

    const welcomeMessage = `
🎯 Добро пожаловать в трекер калорий!

Я помогу вам отслеживать потребление калорий и достигать ваших целей.

📋 Доступные команды:
/add [калории] - Добавить калории
/stats - Посмотреть статистику
/goal - Установить цель
/today - Калории за сегодня
/week - Статистика за неделю
/delete - Удалить последнюю запись
/help - Помощь

Начните с установки цели командой /goal
    `;

    await this.bot.sendMessage(chatId, welcomeMessage);
  }

  async handleAdd(msg) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    // Парсим команду: /add 350 завтрак омлет
    const parts = text.split(' ').slice(1); // убираем /add
    
    if (parts.length === 0) {
      await this.bot.sendMessage(chatId, 
        '📝 Укажите количество калорий:\n/add 350\n/add 350 завтрак\n/add 350 завтрак омлет с сыром'
      );
      return;
    }

    const calories = parseInt(parts[0]);
    if (isNaN(calories) || calories <= 0) {
      await this.bot.sendMessage(chatId, '❌ Укажите корректное количество калорий (число больше 0)');
      return;
    }

    const mealType = parts[1] || 'общее';
    const description = parts.slice(2).join(' ') || null;

    await this.db.createUser(chatId); // создаем пользователя если его нет
    const success = await this.db.addCalorieEntry(chatId, calories, mealType, description);

    if (success) {
      const todayTotal = await this.db.getTodayCalories(chatId);
      const user = await this.db.getUser(chatId);
      
      let progressText = '';
      if (user) {
        const goalPercent = Math.round((todayTotal / user.daily_goal) * 100);
        const limitPercent = Math.round((todayTotal / user.daily_limit) * 100);
        
        progressText = `\n\n📊 Прогресс на сегодня:\n`;
        progressText += `Потреблено: ${todayTotal} ккал\n`;
        progressText += `Цель: ${user.daily_goal} ккал (${goalPercent}%)\n`;
        
        if (user.goal_type === 'lose') {
          progressText += `Лимит: ${user.daily_limit} ккал (${limitPercent}%)`;
          
          if (limitPercent >= 90) {
            progressText += '\n⚠️ Вы близки к дневному лимиту!';
          } else if (limitPercent >= 75) {
            progressText += '\n🔶 Приближаетесь к лимиту калорий';
          }
        }
      }

      let responseMessage = `✅ Добавлено: ${calories} ккал`;
      if (mealType !== 'общее') responseMessage += ` (${mealType})`;
      if (description) responseMessage += `\n📝 ${description}`;
      responseMessage += progressText;

      await this.bot.sendMessage(chatId, responseMessage);
    } else {
      await this.bot.sendMessage(chatId, '❌ Ошибка при добавлении записи');
    }
  }

  async handleGoal(msg) {
    const chatId = msg.chat.id;
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔺 Набор массы', callback_data: 'goal_gain' },
            { text: '🔻 Похудение', callback_data: 'goal_lose' }
          ],
          [
            { text: '⚖️ Поддержание веса', callback_data: 'goal_maintain' }
          ]
        ]
      }
    };

    await this.bot.sendMessage(chatId, 
      '🎯 Выберите вашу цель:', 
      keyboard
    );
  }

  async handleGoalCallback(query) {
    const chatId = query.message.chat.id;
    const goalType = query.data.replace('goal_', '');
    
    this.userStates.set(chatId, { 
      action: 'setting_goal', 
      goalType: goalType 
    });

    let goalText = '';
    let recommendedCalories = 2000;

    switch (goalType) {
      case 'gain':
        goalText = '🔺 Набор массы';
        recommendedCalories = 2500;
        break;
      case 'lose':
        goalText = '🔻 Похудение';
        recommendedCalories = 1800;
        break;
      case 'maintain':
        goalText = '⚖️ Поддержание веса';
        recommendedCalories = 2000;
        break;
    }

    await this.bot.editMessageText(
      `${goalText}\n\nВведите вашу дневную цель калорий (рекомендуется: ${recommendedCalories} ккал):`,
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
  }

  async handleGoalInput(msg) {
    const chatId = msg.chat.id;
    const state = this.userStates.get(chatId);
    
    if (!state || state.action !== 'setting_goal') {
      return false; // не наше сообщение
    }

    const calories = parseInt(msg.text);
    if (isNaN(calories) || calories < 800 || calories > 5000) {
      await this.bot.sendMessage(chatId, 
        '❌ Укажите корректное количество калорий (от 800 до 5000)'
      );
      return true;
    }

    await this.db.createUser(chatId);
    const success = await this.db.updateUserGoal(chatId, state.goalType, calories);
    
    if (success) {
      let responseText = '✅ Цель установлена!\n\n';
      
      switch (state.goalType) {
        case 'gain':
          responseText += `🔺 Цель: ${calories} ккал/день для набора массы`;
          break;
        case 'lose':
          const limit = Math.round(calories * 1.1);
          responseText += `🔻 Цель: ${calories} ккал/день для похудения\n`;
          responseText += `⚠️ Лимит: ${limit} ккал/день (будут приходить уведомления)`;
          break;
        case 'maintain':
          responseText += `⚖️ Цель: ${calories} ккал/день для поддержания веса`;
          break;
      }

      responseText += '\n\nТеперь вы можете добавлять калории командой /add';
      
      await this.bot.sendMessage(chatId, responseText);
    } else {
      await this.bot.sendMessage(chatId, '❌ Ошибка при установке цели');
    }

    this.userStates.delete(chatId);
    return true;
  }

  async handleStats(msg) {
    const chatId = msg.chat.id;
    
    const user = await this.db.getUser(chatId);
    if (!user) {
      await this.bot.sendMessage(chatId, '❌ Сначала установите цель командой /goal');
      return;
    }

    const todayTotal = await this.db.getTodayCalories(chatId);
    const weekStats = await this.db.getWeeklyStats(chatId);
    
    let statsText = `📊 Ваша статистика:\n\n`;
    
    // Цель
    let goalEmoji = '';
    switch (user.goal_type) {
      case 'gain': goalEmoji = '🔺'; break;
      case 'lose': goalEmoji = '🔻'; break;
      case 'maintain': goalEmoji = '⚖️'; break;
    }
    
    statsText += `${goalEmoji} Цель: ${user.daily_goal} ккал/день\n`;
    if (user.goal_type === 'lose') {
      statsText += `⚠️ Лимит: ${user.daily_limit} ккал/день\n`;
    }
    
    // Сегодня
    const goalPercent = Math.round((todayTotal / user.daily_goal) * 100);
    statsText += `\n📅 Сегодня: ${todayTotal} ккал (${goalPercent}%)\n`;
    
    if (user.goal_type === 'lose') {
      const limitPercent = Math.round((todayTotal / user.daily_limit) * 100);
      statsText += `Лимит: ${limitPercent}%\n`;
    }

    // Недельная статистика
    if (weekStats.length > 0) {
      statsText += `\n📈 Последние 7 дней:\n`;
      const weekTotal = weekStats.reduce((sum, day) => sum + day.daily_total, 0);
      const avgDaily = Math.round(weekTotal / weekStats.length);
      
      statsText += `Среднее: ${avgDaily} ккал/день\n`;
      
      weekStats.forEach(day => {
        const date = new Date(day.entry_date).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit'
        });
        statsText += `${date}: ${day.daily_total} ккал (${day.entries_count} записей)\n`;
      });
    }

    await this.bot.sendMessage(chatId, statsText);
  }

  async handleToday(msg) {
    const chatId = msg.chat.id;
    
    const entries = await this.db.getTodayEntries(chatId);
    const user = await this.db.getUser(chatId);
    
    if (entries.length === 0) {
      await this.bot.sendMessage(chatId, '📅 Сегодня записей нет\n\nДобавьте калории командой /add');
      return;
    }

    let todayText = '📅 Записи за сегодня:\n\n';
    let totalCalories = 0;

    entries.forEach((entry, index) => {
      totalCalories += entry.calories;
      const time = entry.entry_time.substring(0, 5); // HH:MM
      
      todayText += `${index + 1}. ${entry.calories} ккал`;
      if (entry.meal_type !== 'general') todayText += ` (${entry.meal_type})`;
      todayText += ` - ${time}`;
      if (entry.description) todayText += `\n   📝 ${entry.description}`;
      todayText += '\n\n';
    });

    todayText += `💯 Всего: ${totalCalories} ккал`;
    
    if (user) {
      const goalPercent = Math.round((totalCalories / user.daily_goal) * 100);
      todayText += `\n🎯 Цель: ${user.daily_goal} ккал (${goalPercent}%)`;
    }

    await this.bot.sendMessage(chatId, todayText);
  }

  async handleWeek(msg) {
    const chatId = msg.chat.id;
    
    const weekStats = await this.db.getWeeklyStats(chatId);
    
    if (weekStats.length === 0) {
      await this.bot.sendMessage(chatId, '📈 Записей за неделю нет');
      return;
    }

    let weekText = '📈 Статистика за неделю:\n\n';
    
    const weekTotal = weekStats.reduce((sum, day) => sum + day.daily_total, 0);
    const avgDaily = Math.round(weekTotal / weekStats.length);
    
    weekText += `Среднее: ${avgDaily} ккал/день\n`;
    weekText += `Общее: ${weekTotal} ккал\n\n`;
    
    weekStats.forEach(day => {
      const date = new Date(day.entry_date);
      const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
      const dateStr = date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit'
      });
      
      weekText += `${dayName} ${dateStr}: ${day.daily_total} ккал (${day.entries_count} записей)\n`;
    });

    await this.bot.sendMessage(chatId, weekText);
  }

  async handleDelete(msg) {
    const chatId = msg.chat.id;
    
    const deletedEntry = await this.db.deleteLastEntry(chatId);
    
    if (deletedEntry) {
      let deleteText = `✅ Удалена запись: ${deletedEntry.calories} ккал`;
      if (deletedEntry.meal_type !== 'general') {
        deleteText += ` (${deletedEntry.meal_type})`;
      }
      if (deletedEntry.description) {
        deleteText += `\n📝 ${deletedEntry.description}`;
      }
      
      const newTotal = await this.db.getTodayCalories(chatId);
      deleteText += `\n\n📊 Осталось сегодня: ${newTotal} ккал`;
      
      await this.bot.sendMessage(chatId, deleteText);
    } else {
      await this.bot.sendMessage(chatId, '❌ Нет записей для удаления за сегодня');
    }
  }

  async handleHelp(msg) {
    const helpText = `
🤖 Помощь по использованию бота:

📝 Добавление калорий:
/add 350 - добавить 350 ккал
/add 350 завтрак - с указанием приема пищи
/add 350 завтрак омлет - с описанием

📊 Просмотр данных:
/today - записи за сегодня
/stats - общая статистика
/week - статистика за неделю

⚙️ Настройки:
/goal - установить/изменить цель
/delete - удалить последнюю запись

🎯 Типы целей:
• Набор массы - увеличенная норма калорий
• Похудение - с лимитом и уведомлениями
• Поддержание - стандартная норма

🔔 Уведомления (только для похудения):
Бот предупредит, когда вы приближаетесь к дневному лимиту калорий.
    `;

    await this.bot.sendMessage(msg.chat.id, helpText);
  }
}

export default CommandHandler;

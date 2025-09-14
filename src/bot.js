import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import CommandHandler from './commands.js';
import NotificationService from './notifications.js';

dotenv.config();

class CalorieTrackerBot {
  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    // Улучшенная валидация токена
    if (!token || token === '8416218364:AAGiyK6j8KkWuxUrXoe524nrHr3ulklaY88' || token.length < 10) {
      console.error(`
❌ ОШИБКА КОНФИГУРАЦИИ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Токен бота не настроен правильно!

📋 Что нужно сделать:
1. Откройте @BotFather в Telegram
2. Создайте нового бота командой /newbot  
3. Скопируйте полученный токен
4. Замените YOUR_BOT_TOKEN_HERE в файле .env на ваш токен

💡 Пример правильного токена: 123456789:AAFsD3F4sdf4sd5f4sd6f4sd6f4sd

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
      process.exit(1);
    }

    console.log('🔧 Инициализация бота...');
    
    try {
      this.bot = new TelegramBot(token, { polling: true });
      this.commandHandler = new CommandHandler(this.bot);
      this.notificationService = new NotificationService(this.bot);
      
      this.setupHandlers();
      console.log('🤖 Бот запущен успешно!');
    } catch (error) {
      console.error('❌ Ошибка при запуске бота:', error.message);
      process.exit(1);
    }
  }

  setupHandlers() {
    // Обработка ошибок с более понятными сообщениями
    this.bot.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 404) {
        console.error(`
❌ ОШИБКА TELEGRAM API:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Проблема: Telegram не может найти ваш бот (404 ошибка)

💡 Возможные причины:
• Неправильный токен в .env файле
• Токен не от @BotFather  
• Бот был удален в @BotFather

🔧 Решение:
1. Проверьте токен в .env файле
2. Убедитесь что токен актуальный от @BotFather
3. Перезапустите бот после исправления

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
      } else {
        console.error('Ошибка polling:', error.message);
      }
    });

    this.bot.on('error', (error) => {
      console.error('Ошибка бота:', error.message);
    });

    // Команды
    this.bot.onText(/\/start/, (msg) => {
      this.commandHandler.handleStart(msg);
    });

    this.bot.onText(/\/add(.*)/, (msg) => {
      this.commandHandler.handleAdd(msg);
    });

    this.bot.onText(/\/goal/, (msg) => {
      this.commandHandler.handleGoal(msg);
    });

    this.bot.onText(/\/stats/, (msg) => {
      this.commandHandler.handleStats(msg);
    });

    this.bot.onText(/\/today/, (msg) => {
      this.commandHandler.handleToday(msg);
    });

    this.bot.onText(/\/week/, (msg) => {
      this.commandHandler.handleWeek(msg);
    });

    this.bot.onText(/\/delete/, (msg) => {
      this.commandHandler.handleDelete(msg);
    });

    this.bot.onText(/\/help/, (msg) => {
      this.commandHandler.handleHelp(msg);
    });

    // Скрытая команда для тестирования уведомлений
    this.bot.onText(/\/test_notification/, (msg) => {
      this.notificationService.testNotification(msg.chat.id);
    });

    // Callback запросы (inline кнопки)
    this.bot.on('callback_query', (query) => {
      if (query.data.startsWith('goal_')) {
        this.commandHandler.handleGoalCallback(query);
      }
    });

    // Обычные сообщения (для ввода целей и калорий)
    this.bot.on('message', async (msg) => {
      // Пропускаем команды
      if (msg.text && msg.text.startsWith('/')) return;
      
      // Проверяем, не ожидает ли пользователь ввода цели
      const handled = await this.commandHandler.handleGoalInput(msg);
      
      if (!handled) {
        // Пытаемся распознать число как калории
        const text = msg.text?.trim();
        if (text && /^\d+$/.test(text)) {
          const calories = parseInt(text);
          if (calories > 0 && calories < 10000) {
            // Имитируем команду /add
            const fakeMsg = {
              ...msg,
              text: `/add ${calories}`
            };
            await this.commandHandler.handleAdd(fakeMsg);
            return;
          }
        }
        
        // Если ничего не подошло, показываем справку
        const helpMessage = `
❓ Не понимаю команду.

💡 Быстрый ввод:
Просто отправьте число - я пойму, что это калории!
Например: 350

📋 Или используйте команды:
/add 350 - добавить калории
/today - калории за сегодня  
/stats - статистика
/help - все команды
        `;
        
        await this.bot.sendMessage(msg.chat.id, helpMessage.trim());
      }
    });
  }

  // Graceful shutdown
  setupGracefulShutdown() {
    process.on('SIGINT', () => {
      console.log('\n🛑 Получен сигнал SIGINT, завершаем работу...');
      this.commandHandler.db.close();
      this.notificationService.db.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Получен сигнал SIGTERM, завершаем работу...');
      this.commandHandler.db.close();
      this.notificationService.db.close();
      process.exit(0);
    });
  }
}

// Запуск бота
const bot = new CalorieTrackerBot();
bot.setupGracefulShutdown();

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Database {
  constructor(dbPath = '../calories.db') {
    const fullPath = path.resolve(__dirname, dbPath);
    this.db = new sqlite3.Database(fullPath);
    
    // Промисифицируем методы для удобства
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
    
    this.initDatabase();
  }

  async initDatabase() {
    try {
      // Таблица пользователей
      await this.run(`
        CREATE TABLE IF NOT EXISTS users (
          chat_id INTEGER PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          goal_type TEXT CHECK(goal_type IN ('gain', 'lose', 'maintain')) DEFAULT 'maintain',
          daily_goal INTEGER DEFAULT 2000,
          daily_limit INTEGER DEFAULT 2500,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Таблица записей калорий
      await this.run(`
        CREATE TABLE IF NOT EXISTS calorie_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id INTEGER,
          calories INTEGER NOT NULL,
          meal_type TEXT DEFAULT 'general',
          description TEXT,
          entry_date DATE DEFAULT (date('now')),
          entry_time TIME DEFAULT (time('now')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      // Таблица настроек уведомлений
      await this.run(`
        CREATE TABLE IF NOT EXISTS notification_settings (
          chat_id INTEGER PRIMARY KEY,
          enabled BOOLEAN DEFAULT 1,
          warning_threshold REAL DEFAULT 0.8,
          last_notification DATE,
          FOREIGN KEY (chat_id) REFERENCES users (chat_id)
        )
      `);

      console.log('База данных успешно инициализирована');
    } catch (error) {
      console.error('Ошибка инициализации базы данных:', error);
    }
  }

  // Методы для работы с пользователями
  async createUser(chatId, username = null, firstName = null) {
    try {
      await this.run(`
        INSERT OR IGNORE INTO users (chat_id, username, first_name)
        VALUES (?, ?, ?)
      `, [chatId, username, firstName]);

      // Создаем настройки уведомлений для нового пользователя
      await this.run(`
        INSERT OR IGNORE INTO notification_settings (chat_id)
        VALUES (?)
      `, [chatId]);

      return true;
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      return false;
    }
  }

  async getUser(chatId) {
    try {
      return await this.get('SELECT * FROM users WHERE chat_id = ?', [chatId]);
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      return null;
    }
  }

  async updateUserGoal(chatId, goalType, dailyGoal, dailyLimit = null) {
    try {
      const limit = dailyLimit || (goalType === 'lose' ? dailyGoal * 1.1 : dailyGoal * 1.3);
      
      await this.run(`
        UPDATE users 
        SET goal_type = ?, daily_goal = ?, daily_limit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE chat_id = ?
      `, [goalType, dailyGoal, limit, chatId]);

      return true;
    } catch (error) {
      console.error('Ошибка обновления цели:', error);
      return false;
    }
  }

  // Методы для работы с калориями
  async addCalorieEntry(chatId, calories, mealType = 'general', description = null) {
    try {
      await this.run(`
        INSERT INTO calorie_entries (chat_id, calories, meal_type, description)
        VALUES (?, ?, ?, ?)
      `, [chatId, calories, mealType, description]);

      return true;
    } catch (error) {
      console.error('Ошибка добавления калорий:', error);
      return false;
    }
  }

  async getTodayCalories(chatId) {
    try {
      const result = await this.get(`
        SELECT COALESCE(SUM(calories), 0) as total_calories
        FROM calorie_entries
        WHERE chat_id = ? AND entry_date = date('now')
      `, [chatId]);

      return result ? result.total_calories : 0;
    } catch (error) {
      console.error('Ошибка получения калорий за сегодня:', error);
      return 0;
    }
  }

  async getTodayEntries(chatId) {
    try {
      return await this.all(`
        SELECT * FROM calorie_entries
        WHERE chat_id = ? AND entry_date = date('now')
        ORDER BY entry_time DESC
      `, [chatId]);
    } catch (error) {
      console.error('Ошибка получения записей за сегодня:', error);
      return [];
    }
  }

  async getWeeklyStats(chatId) {
    try {
      return await this.all(`
        SELECT 
          entry_date,
          SUM(calories) as daily_total,
          COUNT(*) as entries_count
        FROM calorie_entries
        WHERE chat_id = ? 
        AND entry_date >= date('now', '-7 days')
        GROUP BY entry_date
        ORDER BY entry_date DESC
      `, [chatId]);
    } catch (error) {
      console.error('Ошибка получения недельной статистики:', error);
      return [];
    }
  }

  async getUsersNeedingNotification(threshold = 0.8) {
    try {
      return await this.all(`
        SELECT 
          u.chat_id,
          u.daily_limit,
          COALESCE(SUM(ce.calories), 0) as today_calories,
          ns.warning_threshold
        FROM users u
        LEFT JOIN calorie_entries ce ON u.chat_id = ce.chat_id 
          AND ce.entry_date = date('now')
        JOIN notification_settings ns ON u.chat_id = ns.chat_id
        WHERE ns.enabled = 1
        AND (ns.last_notification != date('now') OR ns.last_notification IS NULL)
        AND u.goal_type = 'lose'
        GROUP BY u.chat_id
        HAVING (today_calories / CAST(u.daily_limit AS REAL)) >= ns.warning_threshold
      `);
    } catch (error) {
      console.error('Ошибка получения пользователей для уведомления:', error);
      return [];
    }
  }

  async updateNotificationSent(chatId) {
    try {
      await this.run(`
        UPDATE notification_settings 
        SET last_notification = date('now')
        WHERE chat_id = ?
      `, [chatId]);
    } catch (error) {
      console.error('Ошибка обновления уведомления:', error);
    }
  }

  async deleteLastEntry(chatId) {
    try {
      const lastEntry = await this.get(`
        SELECT * FROM calorie_entries
        WHERE chat_id = ? AND entry_date = date('now')
        ORDER BY created_at DESC
        LIMIT 1
      `, [chatId]);

      if (lastEntry) {
        await this.run('DELETE FROM calorie_entries WHERE id = ?', [lastEntry.id]);
        return lastEntry;
      }
      return null;
    } catch (error) {
      console.error('Ошибка удаления последней записи:', error);
      return null;
    }
  }

  close() {
    this.db.close();
  }
}

export default Database;

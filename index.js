import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    return;
  }
  console.log("Connected to the database.");

  const createTasksTableSQL = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;

  connection.query(createTasksTableSQL, (err, results) => {
    if (err) {
      console.error("Error creating tasks table:", err.message);
    } else {
      console.log("Tasks table created or already exists.");
    }

    const addPriority = `ALTER TABLE tasks ADD COLUMN priority ENUM('low', 'normal', 'high') DEFAULT 'normal';`;

    connection.query(addPriority, (err, results) => {
      if (err) {
        console.error("Error altering table:", err.message);
      } else {
        console.log("Priority column added to tasks table or already exists.");
      }
      connection.end((err) => {
        if (err) {
          console.error("Error closing database:", err.message);
        } else {
          console.log("Database connection closed.");
        }
      });
    });
  });
});

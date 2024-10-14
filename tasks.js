import mysql from "mysql2";
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import readline from "readline";
import chalk from "chalk";
import player from "play-sound";
const soundPlayer = player();

const pool = mysql
  .createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  })
  .promise();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function connectToDatabase() {
  try {
    await pool.getConnection();
    console.log("Connected to the database.");
  } catch (err) {
    console.error("Error connecting to the database:", err);
    process.exit(1);
  }
}

// Function for colored output
function log(message, color = "white") {
  const colors = {
    white: chalk.white,
    green: chalk.green,
    red: chalk.red,
    yellow: chalk.yellow,
    blue: chalk.blue,
    cyan: chalk.cyan,
  };
  console.log(colors[color](message));
}

//Functions for sound
function interfaceSound() {
  soundPlayer.play("./sounds/interface.mp3", (err) => {
    if (err) console.error("Error playing sound:", err);
  });
}

function errorSound() {
  soundPlayer.play("./sounds/error.mp3", (err) => {
    if (err) console.error("Error playing sound:", err);
  });
}
function completeSound() {
  soundPlayer.play("./sounds/complete.mp3", (err) => {
    if (err) console.error("Error playing sound:", err);
  });
}
function successSound() {
  soundPlayer.play("./sounds/success.mp3", (err) => {
    if (err) console.error("Error playing sound:", err);
  });
}

async function taskSaved() {
  try {
    const [results] = await pool.query("SELECT * FROM tasks ORDER BY id");
    const updatedTasks = results.map((task, index) => ({
      ...task,
      id: index + 1,
    }));
    await fs.promises.writeFile(
      "./tasks.json",
      JSON.stringify(updatedTasks, null, 2)
    );
    log("Tasks saved to tasks.json with updated IDs.", "green");
  } catch (err) {
    log("❌ There was an error saving tasks to JSON.", "red");
  }
}

function exitMenu() {
  completeSound();
  log("Exiting the task manager.");
  rl.close();
  pool.end();
}

async function addTasks() {
  try {
    const taskTitle = await new Promise((resolve) =>
      rl.question("Insert a new task title: ", resolve)
    );
    const taskDescription = await new Promise((resolve) =>
      rl.question("Insert a description for the task: ", resolve)
    );
    const priority = await new Promise((resolve) =>
      rl.question("Set task priority (low/normal/high): ", resolve)
    );

    const addTask = `INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)`;
    const [result] = await pool.query(addTask, [
      taskTitle,
      taskDescription,
      priority,
    ]);

    log(`Task "${taskTitle}" added with ID: ${result.insertId}`, "green");
    completeSound();
    await viewTasks();
  } catch (err) {
    log("❌ Error adding task:", "red", err);
    errorSound();
  }
}

async function deleteTasks() {
  try {
    const [results] = await pool.query("SELECT * FROM tasks");
    results.forEach((task, index) =>
      log(`${index + 1}: ${task.title}, ${task.priority}`)
    );

    const deleteUser = await new Promise((resolve) => {
      rl.question("Insert the number of the task to be removed: ", (answer) => {
        resolve(parseInt(answer));
      });
    });

    if (deleteUser > 0 && deleteUser <= results.length) {
      const deleteTask = `DELETE FROM tasks WHERE id = ?`;
      await pool.query(deleteTask, [results[deleteUser - 1].id]);
      log(`Task "${results[deleteUser - 1].title}" removed.`, "green");
      successSound();
      await viewTasks();
    } else {
      log("❌ Invalid choice", "red");
      errorSound();
    }
  } catch (err) {
    log("❌ Error deleting task:", "red", err);
    errorSound();
  }
  await menuInterface();
}

async function markDone() {
  try {
    const [results] = await pool.query("SELECT * FROM tasks");
    results.forEach((task, index) => log(`${index + 1}: ${task.title}`));

    const markUser = await new Promise((resolve) => {
      rl.question(
        "Insert the number of the task to be marked as done: ",
        (answer) => {
          resolve(parseInt(answer));
        }
      );
    });

    if (markUser > 0 && markUser <= results.length) {
      await pool.query(`UPDATE tasks SET title = ? WHERE id = ?`, [
        `[Done] ${results[markUser - 1].title}`,
        results[markUser - 1].id,
      ]);
      log(`Task "${results[markUser - 1].title}" marked as done ✅`, "green");
      completeSound();
      await taskSaved();
    } else {
      log("❌ Invalid choice", "red");
      errorSound();
    }
  } catch (err) {
    log("❌ Error marking task as done:", "red", err);
    errorSound();
  }
  await menuInterface();
}

async function filterTasksByStatus() {
  try {
    const status = await new Promise((resolve) => {
      rl.question("Enter the status to filter by (pending/done): ", resolve);
    });

    const filterSQL = `SELECT * FROM tasks WHERE title LIKE ?`;
    const query = status.toLowerCase() === "done" ? "[Done]%" : "%";

    const [results] = await pool.query(filterSQL, [query]);

    if (results.length === 0) {
      log("❌ No tasks found for the selected status.", "red");
      errorSound();
    } else {
      log(
        `📝 Tasks with status "${status}":\n` +
          results.map((task) => `${task.id}: ${task.title}`).join("\n"),
        "green"
      );
    }

    await taskSaved();
    await menuInterface();
  } catch (err) {
    log("❌ Error: ", "red", err);
    errorSound();
  }
}

async function viewTasks() {
  const answer = await new Promise((resolve) => {
    rl.question(
      "Sort tasks by:\n" +
        "1. Title\n" +
        "2. Priority\n" +
        "Choose an option: ",
      resolve
    );
  });

  let orderBy = parseInt(answer) === 2 ? "priority" : "title";

  try {
    const [results] = await pool.query(
      `SELECT id, title, description, priority FROM tasks ORDER BY ${orderBy}`
    );

    if (results.length === 0) {
      log("❌ No tasks found.", "red");
      errorSound();
    } else {
      log("Tasks:");
      results.forEach((task, index) => {
        const status = task.title.startsWith("[Done]")
          ? "✅ Done"
          : "🔄 Pending";
        log(
          `${index + 1}.📝 Task : ${chalk.cyanBright(task.title)}
          Description: ${task.description},
          Status: ${status},
          Priority: ${task.priority}\n`,
          "green"
        );
      });
    }
  } catch (err) {
    log("❌ Error: ", "red", err);
    errorSound();
  }

  await menuInterface();
}

async function searchTasks() {
  const keyword = await new Promise((resolve) => {
    rl.question("Enter a keyword to search for tasks: ", resolve);
  });

  const searchSQL = `
        SELECT id, title, description, priority 
        FROM tasks 
        WHERE title LIKE ?
    `;
  const query = `%${keyword}%`;

  try {
    const [results] = await pool.query(searchSQL, [query]);

    if (results.length === 0) {
      log("No tasks found.", "red");
      errorSound();
    } else {
      log(`📝 Tasks matching the keyword "${keyword}":`);
      results.forEach((task, index) => {
        log(
          `ID: ${index + 1}, Title: ${chalk.cyanBright(
            task.title
          )}, Description: ${task.description}, Priority: ${task.priority}`,
          "green"
        );
      });
      successSound();
    }
  } catch (err) {
    log("❌ Error: ", "red", err);
    errorSound();
  }

  await menuInterface();
}

async function menuInterface() {
  interfaceSound();
  const answer = await new Promise((resolve) => {
    rl.question(
      "Welcome to your task manager. Press:\n" +
        "1. to see all your tasks\n" +
        "2. to add a task\n" +
        "3. to delete a task\n" +
        "4. to mark a task as done\n" +
        "5. to filter tasks by status\n" +
        "6. to search for tasks\n" +
        "7. to Exit the task manager\n" +
        "Your choice: ",
      resolve
    );
  });

  switch (parseInt(answer)) {
    case 1:
      await viewTasks();
      break;
    case 2:
      await addTasks();
      break;
    case 3:
      await deleteTasks();
      break;
    case 4:
      await markDone();
      break;
    case 5:
      await filterTasksByStatus();
      break;
    case 6:
      await searchTasks();
      break;
    case 7:
      exitMenu();
      return;
    default:
      log("❌ Invalid choice.", "red");
      errorSound();
      await menuInterface();
  }
}

connectToDatabase().then(menuInterface);

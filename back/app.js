const express = require("express");
const cors = require("cors");

// --- Importation des routes ---
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const workoutRoutes = require("./routes/workout.routes");
const exerciseRoutes = require("./routes/exercise.routes");

// --- Importation des middlewares ---
const errorMiddleware = require("./middleware/error.middleware");
const notFoundMiddleware = require("./middleware/not-found.middleware");

const app = express();

// --- Middlewares Globaux ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route de santé pour le CI/CD
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", uptime: process.uptime() });
});

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/exercises", exerciseRoutes);

// --- Gestion des erreurs ---
// Route 404
app.use(notFoundMiddleware);

// Middleware d'erreurs
app.use(errorMiddleware);

module.exports = app;
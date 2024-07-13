const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
    }
});

const db = new sqlite3.Database('./dishes.db');


app.use(cors());
app.use(bodyParser.json());


db.run(`CREATE TABLE IF NOT EXISTS dishes (
  dishId INTEGER PRIMARY KEY AUTOINCREMENT,
  dishName TEXT NOT NULL,
  imageUrl TEXT NOT NULL,
  isPublished BOOLEAN NOT NULL DEFAULT 0
)`);


app.get('/api/dishes', (req, res) => {
    db.all('SELECT * FROM dishes', [], (err, rows) => {
        if (err) {
            res.status(500).send(err.message);
            return;
        }
        res.json(rows);
    });
});


app.post('/api/dishes/toggle/:dishId', (req, res) => {
    const dishId = req.params.dishId;
    db.get('SELECT isPublished FROM dishes WHERE dishId = ?', [dishId], (err, row) => {
        if (err) {
            res.status(500).send(err.message);
            return;
        }
        if (!row) {
            res.status(404).send('Dish not found');
            return;
        }
        const newStatus = !row.isPublished;
        db.run('UPDATE dishes SET isPublished = ? WHERE dishId = ?', [newStatus, dishId], function (err) {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            const updatedDish = { dishId: parseInt(dishId), isPublished: newStatus };
            io.emit('update_dish', updatedDish);
            res.json(updatedDish);
        });
    });
});


app.post('/api/dishes/bulk', (req, res) => {
    const dishes = req.body;
    const placeholders = dishes.map(() => '(?, ?, ?, ?)').join(',');
    const values = dishes.reduce((acc, dish) => {
        return acc.concat([dish.dishId, dish.dishName, dish.imageUrl, dish.isPublished]);
    }, []);

    db.run(`INSERT INTO dishes (dishId, dishName, imageUrl, isPublished) VALUES ${placeholders}`, values, function (err) {
        if (err) {
            res.status(500).send(err.message);
            return;
        }
        io.emit('new_dishes', dishes);
        res.status(201).json(dishes);
    });
});


io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const EXPRESS_PORT = process.env.EXPRESS_PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${EXPRESS_PORT}`;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 14342,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to MySQL database!');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err.stack);
        process.exit(1);
    });

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authentication token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// POST /api/signup
app.post('/api/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ message: 'Please provide name, email, and password' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        const user = { id: result.insertId, name, email };
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'User registered successfully',
            user,
            token
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already registered' });
        }
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Please provide email and password' });

    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = { id: user.id, name: user.name, email: user.email };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Logged in successfully', user: payload, token });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login' });
    }
});

// GET /api/products
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.execute(
            `SELECT p.*, u.name AS seller_name 
             FROM products p 
             JOIN users u ON p.seller_id = u.id`
        );

        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching products' });
    }
});

// GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT p.*, u.name AS seller_name 
             FROM products p 
             JOIN users u ON p.seller_id = u.id 
             WHERE p.id = ?`,
            [id]
        );

        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found' });

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching product' });
    }
});

// POST /api/products
app.post('/api/products', authenticateToken, async (req, res) => {
    const { title, price, category, description, image_url, contact_number } = req.body;
    const seller_id = req.user.id;

    if (!title || !price || !category || !description || !contact_number || !image_url) {
        return res.status(400).json({ message: 'Missing required product fields' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO products (title, price, category, description, image_url, contact_number, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, price, category, description, image_url, contact_number, seller_id]
        );

        const newProduct = {
            id: result.insertId,
            title,
            price,
            category,
            description,
            image_url,
            contact_number,
            seller_id,
            sold: false,
            created_at: new Date().toISOString().split('T')[0]
        };

        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding product' });
    }
});

// PUT /api/products/:id
app.put('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, price, category, description, image_url, contact_number, sold } = req.body;
    const seller_id = req.user.id;

    try {
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found or not authorized' });

        await pool.execute(
            `UPDATE products SET title = ?, price = ?, category = ?, description = ?, image_url = ?, contact_number = ?, sold = ? WHERE id = ?`,
            [
                title || product.title,
                price || product.price,
                category || product.category,
                description || product.description,
                image_url || product.image_url,
                contact_number || product.contact_number,
                sold !== undefined ? sold : product.sold,
                id
            ]
        );

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error updating product' });
    }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const seller_id = req.user.id;

    try {
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found or not authorized' });

        await pool.execute('DELETE FROM products WHERE id = ?', [id]);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

// Start Server
app.listen(EXPRESS_PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
});

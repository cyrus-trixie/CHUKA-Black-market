// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based MySQL client
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // For file uploads
const path = require('path');
const fs = require('fs');

const app = express();

// Use environment variables
const EXPRESS_PORT = process.env.EXPRESS_PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${EXPRESS_PORT}`;

// Middleware
app.use(cors()); // Enable CORS (adjust origins for production)
app.use(express.json()); // Parse JSON bodies
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdir(uploadDir, { recursive: true }, (err) => {
            if (err) console.error('Error creating uploads directory:', err);
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

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

// Test DB connection
pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to MySQL database!');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err.stack);
        process.exit(1);
    });

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authentication token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification failed:', err);
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// --- API Routes ---

// POST /api/signup - Register user
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
        const accessToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'User registered successfully',
            user: { id: user.id, name: user.name, email: user.email },
            token: accessToken
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already registered' });
        }
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// POST /api/login - Authenticate user
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Please provide email and password' });

    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const userPayload = { id: user.id, name: user.name, email: user.email };
        const accessToken = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Logged in successfully', user: userPayload, token: accessToken });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// GET /api/products - Get all products
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.execute(
            `SELECT p.*, u.name AS seller_name 
             FROM products p 
             JOIN users u ON p.seller_id = u.id`
        );

        const productsWithFullImageUrl = products.map(product => ({
            ...product,
            image_url: product.image_url ? `${BASE_URL}/${product.image_url}` : null
        }));

        res.status(200).json(productsWithFullImageUrl);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products' });
    }
});

// GET /api/products/:id - Get product by ID
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

        product.image_url = product.image_url ? `${BASE_URL}/${product.image_url}` : null;
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ message: 'Server error fetching product' });
    }
});

// POST /api/products - Add product (protected + upload)
app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
    const { title, price, category, description, contact_number } = req.body;
    const seller_id = req.user.id;
    const image_url = req.file ? `uploads/${req.file.filename}` : null;

    if (!title || !price || !category || !description || !contact_number) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => err && console.error('Error deleting file:', err));
        }
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
            image_url: image_url ? `${BASE_URL}/${image_url}` : null,
            contact_number,
            seller_id,
            sold: false,
            created_at: new Date().toISOString().split('T')[0]
        };

        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => err && console.error('Error deleting file:', err));
        }
        console.error('Error adding product:', error);
        res.status(500).json({ message: 'Server error adding product' });
    }
});

// PUT /api/products/:id - Update product (protected)
app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { title, price, category, description, contact_number, sold } = req.body;
    const seller_id = req.user.id;

    try {
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) {
            if (req.file) {
                fs.unlink(req.file.path, (err) => err && console.error('Error deleting file:', err));
            }
            return res.status(404).json({ message: 'Product not found or not authorized' });
        }

        if (req.file && product.image_url) {
            const oldImagePath = path.join(__dirname, product.image_url);
            fs.unlink(oldImagePath, (err) => err && console.error('Error deleting old image:', err));
        }

        const image_url = req.file ? `uploads/${req.file.filename}` : product.image_url;

        await pool.execute(
            `UPDATE products SET title = ?, price = ?, category = ?, description = ?, image_url = ?, contact_number = ?, sold = ? WHERE id = ?`,
            [title || product.title, price || product.price, category || product.category, description || product.description, image_url, contact_number || product.contact_number, sold !== undefined ? sold : product.sold, id]
        );

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => err && console.error('Error deleting file:', err));
        }
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server error updating product' });
    }
});

// DELETE /api/products/:id - Delete product (protected)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const seller_id = req.user.id;

    try {
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found or not authorized' });

        if (product.image_url) {
            const imagePath = path.join(__dirname, product.image_url);
            fs.unlink(imagePath, (err) => err && console.error('Error deleting product image:', err));
        }

        await pool.execute('DELETE FROM products WHERE id = ?', [id]);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

// GET /api/profile - Get logged-in user's profile (protected)
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
});

// Start server
app.listen(EXPRESS_PORT, () => {
    console.log(`Server is running on port ${EXPRESS_PORT}`);
    console.log(`Base URL set to ${BASE_URL}`);
});

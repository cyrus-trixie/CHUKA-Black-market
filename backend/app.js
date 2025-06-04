// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based MySQL client
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // Import multer for file uploads
const path = require('path'); // Import path module for file paths
const fs = require('fs');

const app = express();
// Use a standard port for the Express server, eg., 5000.
// The PORT variable in your .env (14342) is likely for the MySQL database.
const EXPRESS_PORT = process.env.EXPRESS_PORT || 5000; 

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json()); // Enable JSON body parsing
// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create 'uploads' directory if it doesn't exist
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdir(uploadDir, { recursive: true }, (err) => {
            if (err) console.error('Error creating uploads directory:', err);
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});

const upload = multer({ storage: storage });

// Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 14342, // Use DB_PORT from .env, or default to 14342 for Aiven
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection
pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to MySQL database!');
        connection.release(); // Release the connection immediately after testing
    })
    .catch(err => {
        console.error('Database connection failed:', err.stack);
        process.exit(1); // Exit if DB connection fails
    });

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification failed:', err);
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user; // Attach user payload to request
        next();
    });
};

// --- API Routes ---

// 1. User Authentication Routes

// POST /api/signup - Register a new user
app.post('/api/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Generate JWT token
        const user = { id: result.insertId, name, email };
        const accessToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ message: 'User registered successfully', user: { id: user.id, name: user.name, email: user.email }, token: accessToken });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email already registered' });
        }
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// POST /api/login - Authenticate a user
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        // Find user by email
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const userPayload = { id: user.id, name: user.name, email: user.email };
        const accessToken = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Logged in successfully', user: userPayload, token: accessToken });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// 2. Product Management Routes

// GET /api/products - Get all products
app.get('/api/products', async (req, res) => {
    try {
        // Join products with users to get seller name
        const [products] = await pool.execute(
            `SELECT p.*, u.name AS seller_name 
             FROM products p 
             JOIN users u ON p.seller_id = u.id`
        );
        // Prepend base URL to image_url for frontend consumption
        const productsWithFullImageUrl = products.map(product => ({
            ...product,
            image_url: product.image_url ? `http://localhost:${EXPRESS_PORT}/${product.image_url}` : null
        }));
        res.status(200).json(productsWithFullImageUrl);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Server error fetching products' });
    }
});

// GET /api/products/:id - Get a single product by ID
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
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Prepend base URL to image_url for frontend consumption
        product.image_url = product.image_url ? `http://localhost:${EXPRESS_PORT}/${product.image_url}` : null;
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ message: 'Server error fetching product' });
    }
});

// POST /api/products - Add a new product (protected, with file upload)
app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
    const { title, price, category, description, contact_number } = req.body;
    const seller_id = req.user.id; // Get seller_id from authenticated user
    const image_url = req.file ? `uploads/${req.file.filename}` : null; // Path to the uploaded image

    if (!title || !price || !category || !description || !contact_number) {
        // If required fields are missing, delete the uploaded file if any
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
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
            image_url: image_url ? `http://localhost:${EXPRESS_PORT}/${image_url}` : null, // Return full URL
            contact_number, 
            seller_id, 
            sold: false, 
            created_at: new Date().toISOString().split('T')[0] 
        };
        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        // If DB insertion fails, delete the uploaded file if any
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        console.error('Error adding product:', error);
        res.status(500).json({ message: 'Server error adding product' });
    }
});

// PUT /api/products/:id - Update a product (protected)
app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { title, price, category, description, contact_number, sold } = req.body;
    const seller_id = req.user.id;

    try {
        // Check if product exists and belongs to user
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) {
            // Delete uploaded file if any
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            }
            return res.status(404).json({ message: 'Product not found or not authorized' });
        }

        // If new image uploaded, delete old image file
        if (req.file && product.image_url) {
            const oldImagePath = path.join(__dirname, product.image_url);
            fs.unlink(oldImagePath, (err) => {
                if (err) console.error('Error deleting old image:', err);
            });
        }

        const image_url = req.file ? `uploads/${req.file.filename}` : product.image_url;

        // Update the product in DB
        await pool.execute(
            `UPDATE products SET title = ?, price = ?, category = ?, description = ?, image_url = ?, contact_number = ?, sold = ? WHERE id = ?`,
            [title || product.title, price || product.price, category || product.category, description || product.description, image_url, contact_number || product.contact_number, sold !== undefined ? sold : product.sold, id]
        );

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        // Delete uploaded file if any on error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Server error updating product' });
    }
});

// DELETE /api/products/:id - Delete a product (protected)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const seller_id = req.user.id;

    try {
        // Check if product exists and belongs to user
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) {
            return res.status(404).json({ message: 'Product not found or not authorized' });
        }

        // Delete image file from uploads folder if exists
        if (product.image_url) {
            const imagePath = path.join(__dirname, product.image_url);
            fs.unlink(imagePath, (err) => {
                if (err) console.error('Error deleting image:', err);
            });
        }

        // Delete the product from database
        await pool.execute('DELETE FROM products WHERE id = ?', [id]);

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

// --- Server start ---
app.listen(EXPRESS_PORT, () => {
    console.log(`Server running on http://localhost:${EXPRESS_PORT}`);
});

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // Import multer
const path = require('path'); // Import path for directory handling
const fs = require('fs'); // Import file system module
const { v2: cloudinary } = require('cloudinary'); // Import Cloudinary
const { CloudinaryStorage } = require('multer-storage-cloudinary'); // Import Cloudinary storage for multer

const app = express();

const EXPRESS_PORT = process.env.EXPRESS_PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${EXPRESS_PORT}`;

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer storage configuration using Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'campus_marketplace_images', // Optional: Specify a folder in your Cloudinary account
        allowed_formats: ['jpeg', 'png', 'jpg', 'gif']
    },
});

const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB limit

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

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
        console.error("Signup error:", error); // Log the actual error
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
        console.error("Login error:", error); // Log the actual error
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
        console.error("Error fetching products:", error); // Log the actual error
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
        console.error("Error fetching product by ID:", error); // Log the actual error
        res.status(500).json({ message: 'Server error fetching product' });
    }
});

// POST /api/products
app.post('/api/products', authenticateToken, upload.single('image_file'), async (req, res) => {
    // When using multer-storage-cloudinary, req.file contains information about the uploaded image
    const { title, price, category, description, contact_number, location } = req.body;
    const seller_id = req.user.id;
    const image_url = req.file ? req.file.path : null; // Cloudinary URL

    if (!title || !price || !category || !description || !contact_number || !location) {
        return res.status(400).json({ message: 'Missing required product fields: title, price, category, description, contact number, location.' });
    }

    // Validate price as a number
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid positive number.' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO products (title, price, category, description, image_url, contact_number, location, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, parsedPrice, category, description, image_url, contact_number, location, seller_id]
        );

        const newProduct = {
            id: result.insertId,
            title,
            price: parsedPrice,
            category,
            description,
            image_url, // Cloudinary URL
            contact_number,
            location,
            seller_id,
            sold: false,
            created_at: new Date().toISOString().split('T')[0]
        };

        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error("Error adding product:", error); // Log the actual error
        res.status(500).json({ message: 'Server error adding product' });
    }
});

// PUT /api/products/:id
app.put('/api/products/:id', authenticateToken, upload.single('image_file'), async (req, res) => {
    const { id } = req.params;
    const { title, price, category, description, contact_number, sold, location } = req.body;
    const seller_id = req.user.id;
    const new_image_file = req.file; // Contains Cloudinary information if a new image was uploaded

    try {
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found or not authorized' });

        let updated_image_url = product.image_url;
        let public_id_to_delete = null;

        // If a new image was uploaded
        if (new_image_file) {
            updated_image_url = new_image_file.path;
            // Extract public_id from the old image URL to delete from Cloudinary
            if (product.image_url && product.image_url.includes('cloudinary')) {
                const parts = product.image_url.split('/');
                // Assuming the public_id is the part before the last dot (extension)
                const filenameWithExtension = parts[parts.length - 1];
                public_id_to_delete = `campus_marketplace_images/${filenameWithExtension.substring(0, filenameWithExtension.lastIndexOf('.'))}`;
            }
        }

        const parsedPrice = price !== undefined ? parseFloat(price) : undefined;
        if (price !== undefined && (isNaN(parsedPrice) || parsedPrice < 0)) {
            return res.status(400).json({ message: 'Price must be a valid positive number.' });
        }

        await pool.execute(
            `UPDATE products SET title = ?, price = ?, category = ?, description = ?, image_url = ?, contact_number = ?, location = ?, sold = ? WHERE id = ?`,
            [
                title || product.title,
                parsedPrice !== undefined ? parsedPrice : product.price,
                category || product.category,
                description || product.description,
                updated_image_url,
                contact_number || product.contact_number,
                location || product.location,
                sold !== undefined ? sold : product.sold,
                id
            ]
        );

        // Delete the old image from Cloudinary if a new one was uploaded and an old one existed
        if (public_id_to_delete) {
            cloudinary.uploader.destroy(public_id_to_delete, (error, result) => {
                if (error) {
                    console.error(`Error deleting image from Cloudinary (public ID: ${public_id_to_delete}):`, error);
                } else {
                    console.log(`Successfully deleted image from Cloudinary (public ID: ${public_id_to_delete}):`, result);
                }
            });
        }

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error("Error updating product:", error); // Log the actual error
        res.status(500).json({ message: 'Server error updating product' });
    }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const seller_id = req.user.id;

    try {
        const [rows] = await pool.execute('SELECT image_url FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found or not authorized' });

        const public_id_to_delete = extractPublicIdFromUrl(product.image_url);

        await pool.execute('DELETE FROM products WHERE id = ?', [id]);

        // Delete the associated image file from Cloudinary if it exists
        if (public_id_to_delete) {
            cloudinary.uploader.destroy(public_id_to_delete, (error, result) => {
                if (error) {
                    console.error(`Error deleting image from Cloudinary (public ID: ${public_id_to_delete}):`, error);
                } else {
                    console.log(`Successfully deleted image from Cloudinary (public ID: ${public_id_to_delete}):`, result);
                }
            });
        }

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error("Error deleting product:", error); // Log the actual error
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

// Helper function to extract public ID from Cloudinary URL
function extractPublicIdFromUrl(url) {
    if (url && url.includes('cloudinary')) {
        const parts = url.split('/');
        const filenameWithExtension = parts[parts.length - 1];
        return `campus_marketplace_images/${filenameWithExtension.substring(0, filenameWithExtension.lastIndexOf('.'))}`;
    }
    return null;
}

// Start Server
app.listen(EXPRESS_PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
});
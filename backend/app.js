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

const app = express();

const EXPRESS_PORT = process.env.EXPRESS_PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${EXPRESS_PORT}`;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, imagesDir); // Store images in the uploads/images directory
    },
    filename: function (req, file, cb) {
        // Generate a unique filename: fieldname-timestamp.ext
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB file size limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload only supports the following filetypes: " + filetypes));
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use('/uploads', express.static(uploadsDir)); // Serve static files from the uploads directory

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

        // Prepend BASE_URL to image_url if it's a local file path
        const productsWithFullImageUrls = products.map(product => ({
            ...product,
            image_url: product.image_url ? `${BASE_URL}/${product.image_url}` : null
        }));

        res.status(200).json(productsWithFullImageUrls);
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

        // Prepend BASE_URL to image_url if it's a local file path
        if (product.image_url) {
            product.image_url = `${BASE_URL}/${product.image_url}`;
        }

        res.status(200).json(product);
    } catch (error) {
        console.error("Error fetching product by ID:", error); // Log the actual error
        res.status(500).json({ message: 'Server error fetching product' });
    }
});

// POST /api/products
app.post('/api/products', authenticateToken, upload.single('image_file'), async (req, res) => {
    // When using multer, text fields are in req.body, file is in req.file
    const { title, price, category, description, contact_number, location } = req.body;
    const seller_id = req.user.id;
    const image_path = req.file ? `uploads/images/${req.file.filename}` : null; // Path to the uploaded image

    if (!title || !price || !category || !description || !contact_number || !location) {
        // If image was uploaded but other fields are missing, delete the image
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting incomplete upload:", err);
            });
        }
        return res.status(400).json({ message: 'Missing required product fields: title, price, category, description, contact number, location.' });
    }
    
    // Validate price as a number
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting incomplete upload:", err);
            });
        }
        return res.status(400).json({ message: 'Price must be a valid positive number.' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO products (title, price, category, description, image_url, contact_number, location, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, parsedPrice, category, description, image_path, contact_number, location, seller_id]
        );

        const newProduct = {
            id: result.insertId,
            title,
            price: parsedPrice,
            category,
            description,
            image_url: image_path ? `${BASE_URL}/${image_path}` : null, // Send back full URL
            contact_number,
            location,
            seller_id,
            sold: false,
            created_at: new Date().toISOString().split('T')[0]
        };

        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error("Error adding product:", error); // Log the actual error
        // If there's a DB error after file upload, delete the uploaded file
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting failed upload:", err);
            });
        }
        res.status(500).json({ message: 'Server error adding product' });
    }
});

// PUT /api/products/:id
app.put('/api/products/:id', authenticateToken, upload.single('image_file'), async (req, res) => {
    const { id } = req.params;
    const { title, price, category, description, contact_number, sold, location } = req.body; // image_url is now image_file via multer
    const seller_id = req.user.id;
    const new_image_path = req.file ? `uploads/images/${req.file.filename}` : null; // New image path if a new file was uploaded

    try {
        const [rows] = await pool.execute('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, seller_id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ message: 'Product not found or not authorized' });

        let updated_image_url = product.image_url;

        // If a new image was uploaded, delete the old one and update the path
        if (new_image_path) {
            if (product.image_url) {
                // Ensure the path is relative and within the uploads directory before deleting
                const oldImagePath = path.join(__dirname, product.image_url);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error(`Error deleting old image file: ${oldImagePath}`, err);
                    });
                }
            }
            updated_image_url = new_image_path;
        }

        const parsedPrice = price !== undefined ? parseFloat(price) : product.price;
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            if (req.file) { // If a new file was uploaded, delete it due to validation error
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Error deleting incomplete upload during update:", err);
                });
            }
            return res.status(400).json({ message: 'Price must be a valid positive number.' });
        }


        await pool.execute(
            `UPDATE products SET title = ?, price = ?, category = ?, description = ?, image_url = ?, contact_number = ?, location = ?, sold = ? WHERE id = ?`,
            [
                title || product.title,
                parsedPrice,
                category || product.category,
                description || product.description,
                updated_image_url,
                contact_number || product.contact_number,
                location || product.location,
                sold !== undefined ? sold : product.sold,
                id
            ]
        );

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error("Error updating product:", error); // Log the actual error
        // If an error occurs during update, and a new file was uploaded, delete it
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting failed update upload:", err);
            });
        }
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

        // Delete the associated image file if it exists
        if (product.image_url) {
            const imagePath = path.join(__dirname, product.image_url);
            if (fs.existsSync(imagePath)) {
                fs.unlink(imagePath, (err) => {
                    if (err) console.error(`Error deleting image file for product ${id}:`, err);
                });
            }
        }

        await pool.execute('DELETE FROM products WHERE id = ?', [id]);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error("Error deleting product:", error); // Log the actual error
        res.status(500).json({ message: 'Server error deleting product' });
    }
});

// Start Server
app.listen(EXPRESS_PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
});
import React, { useState, useEffect } from 'react';
import { Search, Plus, User, LogOut, Edit, Trash2, Check, X, MapPin } from 'lucide-react'; // Added MapPin icon
import UserDashboard from './UserDashboard';

// In CampusMarketplace.jsx
const API_BASE_URL = 'https://chuka-black-market.onrender.com/api'; // Define your backend API base URL

const CampusMarketplace = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [showAuth, setShowAuth] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [showAddItem, setShowAddItem] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [editingItem, setEditingItem] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const categories = ['all', 'Electronics', 'Books', 'Clothing', 'Furniture', 'Other'];

    // Auth form data
    const [authData, setAuthData] = useState({
        email: '',
        password: '',
        name: ''
    });

    // Add item form data - image_file for upload, location added
    const [newItem, setNewItem] = useState({
        title: '',
        price: '',
        category: 'Electronics',
        description: '',
        image_file: null, // Changed from image_url to image_file
        contact_number: '',
        location: '' // Added location
    });

    // Edit item form data - image_file for new upload, location added
    const [editForm, setEditForm] = useState({ // Separate state for edit form
        title: '',
        price: '',
        category: 'Electronics',
        description: '',
        image_file: null, // New file upload for edit
        current_image_url: '', // To display existing image
        contact_number: '',
        location: '', // Added location
        sold: false
    });

    // Effect to load user from localStorage on initial render
    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        const storedToken = localStorage.getItem('token');
        if (storedUser && storedToken) {
            setCurrentUser(JSON.parse(storedUser));
        }
    }, []);

    // Effect to fetch products from the backend
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/products`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setItems(data);
            } catch (err) {
                console.error("Failed to fetch products:", err);
                setError("Failed to load products. Please ensure the backend server is running and accessible. Error: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Filter items based on search term and selected category
    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase())); // Include location in search
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Get user's items
    const userItems = currentUser
        ? items.filter(item => item.seller_id === currentUser.id)
        : [];

    // Helper function to get auth headers (only for non-multipart/form-data requests)
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    };

    // Handle authentication (login/signup)
    const handleAuth = async (e) => {
        e.preventDefault();
        setError(null);
        const endpoint = authMode === 'login' ? 'login' : 'signup';

        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(authData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Failed to ${endpoint}`);
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            setCurrentUser(data.user);
            setShowAuth(false);
            setAuthData({ email: '', password: '', name: '' });

            // Re-fetch products to ensure seller_name is updated and user's dashboard reflects correctly
            const productsResponse = await fetch(`${API_BASE_URL}/products`);
            const productsData = await productsResponse.json();
            setItems(productsData);

        } catch (err) {
            console.error(`Error during ${endpoint}:`, err);
            setError(err.message || `An error occurred during ${endpoint}.`);
        }
    };

    // Handle user logout
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
    };

    // Handle adding a new item
    const handleAddItem = async (e) => {
        e.preventDefault();
        setError(null);
        if (!currentUser) {
            setError("You must be logged in to add an item.");
            return;
        }

        if (!newItem.title || !newItem.price || !newItem.description || !newItem.contact_number || !newItem.location) {
            setError("Please fill in all required fields (Title, Price, Description, Contact Number, Location).");
            return;
        }

        const formData = new FormData();
        formData.append('title', newItem.title);
        formData.append('price', newItem.price);
        formData.append('category', newItem.category);
        formData.append('description', newItem.description);
        formData.append('contact_number', newItem.contact_number);
        formData.append('location', newItem.location); // Append location
        if (newItem.image_file) {
            formData.append('image_file', newItem.image_file); // Append the actual file
        }

        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // No 'Content-Type' header with FormData
                },
                body: formData // Send FormData directly
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to add item.');
            }

            // After successful add, re-fetch all products to update the list
            const productsResponse = await fetch(`${API_BASE_URL}/products`);
            const productsData = await productsResponse.json();
            setItems(productsData);

            // Reset newItem state
            setNewItem({ title: '', price: '', category: 'Electronics', description: '', image_file: null, contact_number: '', location: '' });
            setShowAddItem(false);
        } catch (err) {
            console.error('Error adding product:', err);
            setError(err.message || 'An error occurred while adding the product.');
        }
    };

    // When opening the edit modal, populate the editForm state with the current item's data
    const startEditingItem = (item) => {
        setEditingItem(item);
        setEditForm({
            title: item.title,
            price: item.price,
            category: item.category,
            description: item.description,
            image_file: null, // Clear file input when opening, user can choose new
            current_image_url: item.image_url, // Store current image URL for display
            contact_number: item.contact_number,
            location: item.location, // Populate location
            sold: item.sold
        });
    };

    // Handle editing an existing item
    const handleEditItem = async (e) => {
        e.preventDefault();
        setError(null);

        if (!editForm.title || !editForm.price || !editForm.description || !editForm.contact_number || !editForm.location) {
            setError("Please fill in all required fields (Title, Price, Description, Contact Number, Location).");
            return;
        }

        const formData = new FormData();
        formData.append('title', editForm.title);
        formData.append('price', editForm.price);
        formData.append('category', editForm.category);
        formData.append('description', editForm.description);
        formData.append('contact_number', editForm.contact_number);
        formData.append('location', editForm.location); // Append location
        formData.append('sold', editForm.sold);
        if (editForm.image_file) {
            formData.append('image_file', editForm.image_file); // Append the new file if selected
        }

        try {
            const response = await fetch(`${API_BASE_URL}/products/${editingItem.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // No 'Content-Type' header with FormData
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update item.');
            }

            const productsResponse = await fetch(`${API_BASE_URL}/products`);
            const productsData = await productsResponse.json();
            setItems(productsData);

            setEditingItem(null); // Close edit modal
        } catch (err) {
            console.error('Error updating product:', err);
            setError(err.message || 'An error occurred while updating the product.');
        }
    };

    // Handle deleting an item
    const handleDeleteItem = async (id) => {
        setError(null);
        if (!window.confirm("Are you sure you want to delete this item?")) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete item.');
            }

            const productsResponse = await fetch(`${API_BASE_URL}/products`);
            const productsData = await productsResponse.json();
            setItems(productsData);

        } catch (err) {
            console.error('Error deleting product:', err);
            setError(err.message || 'An error occurred while deleting the product.');
        }
    };

    // Handle marking an item as sold/available
    const handleMarkSold = async (id) => {
        setError(null);
        const itemToToggle = items.find(item => item.id === id);
        if (!itemToToggle) return;

        const formData = new FormData();
        formData.append('title', itemToToggle.title);
        formData.append('price', itemToToggle.price);
        formData.append('category', itemToToggle.category);
        formData.append('description', itemToToggle.description);
        formData.append('contact_number', itemToToggle.contact_number);
        formData.append('location', itemToToggle.location);
        formData.append('sold', !itemToToggle.sold); // Toggle the sold status

        // No need to send image_file if not changing it, but include current_image_url if your backend expects it for update.
        // For this setup, we'll rely on the backend to keep the existing image if no new file is sent.

        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update item status.');
            }

            const productsResponse = await fetch(`${API_BASE_URL}/products`);
            const productsData = await productsResponse.json();
            setItems(productsData);

        } catch (err) {
            console.error('Error marking product sold/available:', err);
            setError(err.message || 'An error occurred while updating the product status.');
        }
    };

    // Function to open WhatsApp chat with seller
    const handleContactSeller = (itemTitle, sellerContact) => {
        const cleanContact = sellerContact.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(`Hey, is the "${itemTitle}" you're selling still available? I saw it on Chuka Black Market.`);
        const whatsappUrl = `https://wa.me/${cleanContact}?text=${message}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Header section */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-blue-600">Chuka Black Market</h1>
                        </div>

                        <div className="flex items-center space-x-4">
                            {currentUser ? (
                                <>
                                    <button
                                        onClick={() => setShowAddItem(true)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105"
                                        title="Sell a New Item"
                                    >
                                        <Plus size={20} />
                                        <span>Sell Item</span>
                                    </button>
                                    <div className="flex items-center space-x-2">
                                        <User size={20} className="text-gray-600" />
                                        <span className="text-gray-700 font-medium">{currentUser.name}</span>
                                        <button
                                            onClick={handleLogout}
                                            className="text-red-600 hover:text-red-700 transition duration-200 ease-in-out transform hover:scale-105"
                                            title="Logout"
                                        >
                                            <LogOut size={20} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <button
                                    onClick={() => setShowAuth(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105"
                                    title="Login or Sign Up"
                                >
                                    Login / Sign Up
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Error message display */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {error}</span>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
                            <X size={18} className="cursor-pointer" onClick={() => setError(null)} />
                        </span>
                    </div>
                )}

                {/* Search and Filter section */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search items by title, description, or location..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {categories.map(category => (
                                <option key={category} value={category}>
                                    {category === 'all' ? 'All Categories' : category}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* User Dashboard - Only rendered if currentUser exists */}
                {currentUser && (
                    <UserDashboard
                        currentUser={currentUser}
                        userItems={userItems}
                        setItems={setItems}
                        setEditingItem={startEditingItem} // Use the new function to prepare edit form
                        handleDeleteItem={handleDeleteItem}
                        handleMarkSold={handleMarkSold}
                        setShowAddItem={setShowAddItem}
                    />
                )}

                {/* All Available Items Grid */}
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Items</h2>
                {loading ? (
                    <div className="text-center py-12 col-span-full">
                        <p className="text-gray-500 text-lg">Loading items...</p>
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                <div className="relative">
                                    <img
                                        src={item.image_url || `https://placehold.co/300x200/cccccc/333333`}
                                        alt={item.title}
                                        className="w-full h-48 object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/cccccc/333333`; }}
                                    />
                                    {item.sold && (
                                        <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-semibold">
                                            SOLD
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-lg mb-1 text-gray-900 truncate">{item.title}</h3>
                                    <p className="text-2xl font-bold text-blue-600 mb-2">KSh {item.price}</p>
                                    <p className="text-gray-600 text-sm mb-2 line-clamp-3">{item.description}</p>
                                    <div className="flex items-center text-sm text-gray-500 mb-2">
                                        <MapPin size={16} className="mr-1 text-gray-400" />
                                        <span>{item.location}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-gray-500 mt-3">
                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">{item.category}</span>
                                        <span>by <span className="font-medium text-gray-700">{item.seller_name}</span></span>
                                    </div>
                                    {!item.sold && item.contact_number ? (
                                        <button
                                            onClick={() => handleContactSeller(item.title, item.contact_number)}
                                            className="w-full mt-4 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center space-x-2"
                                        >
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-5 h-5" />
                                            <span>Contact Seller</span>
                                        </button>
                                    ) : (
                                        !item.sold && !item.contact_number && (
                                            <p className="w-full mt-4 text-center text-gray-500 text-sm">Seller contact not available.</p>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 col-span-full">
                        <p className="text-gray-500 text-lg">No items found matching your search or filters.</p>
                    </div>
                )}
            </main>

            {/* Authentication Modal (Login/Sign Up) */}
            {showAuth && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {authMode === 'login' ? 'Login' : 'Sign Up'}
                            </h2>
                            <button
                                onClick={() => setShowAuth(false)}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition duration-200"
                                title="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAuth}>
                            {authMode === 'signup' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={authData.name}
                                        onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={authData.email}
                                    onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={authData.password}
                                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 mb-4"
                            >
                                {authMode === 'login' ? 'Login' : 'Sign Up'}
                            </button>
                            <p className="text-center text-sm text-gray-600">
                                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                        setError(null);
                                    }}
                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    {authMode === 'login' ? 'Sign up' : 'Login'}
                                </button>
                            </p>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Item Modal */}
            {showAddItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Add New Item</h2>
                            <button
                                onClick={() => setShowAddItem(false)}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition duration-200"
                                title="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.title}
                                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price (KSh)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={newItem.price}
                                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    required
                                    value={newItem.category}
                                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {categories.filter(c => c !== 'all').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    required
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    required
                                    onChange={(e) => setNewItem({ ...newItem, image_file: e.target.files[0] })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.location}
                                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., Main Campus, Hostel Block B"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number (WhatsApp)</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.contact_number}
                                    onChange={(e) => setNewItem({ ...newItem, contact_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., 0712345678"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105"
                            >
                                Add Item
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Item Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Edit Item</h2>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition duration-200"
                                title="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleEditItem}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price (KSh)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={editForm.price}
                                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    required
                                    value={editForm.category}
                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {categories.filter(c => c !== 'all').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    required
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Image</label>
                                {editForm.current_image_url && (
                                    <img src={editForm.current_image_url} alt="Current Product" className="w-32 h-32 object-cover rounded-md mb-2" />
                                )}
                                <label className="block text-sm font-medium text-gray-700 mb-1">Replace Image (Optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEditForm({ ...editForm, image_file: e.target.files[0] })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.location}
                                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., Main Campus, Hostel Block B"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number (WhatsApp)</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.contact_number}
                                    onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., 0712345678"
                                />
                            </div>
                            <div className="mb-6 flex items-center">
                                <input
                                    type="checkbox"
                                    id="soldCheckbox"
                                    checked={editForm.sold}
                                    onChange={(e) => setEditForm({ ...editForm, sold: e.target.checked })}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="soldCheckbox" className="ml-2 block text-sm text-gray-900">Mark as Sold</label>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105"
                            >
                                Update Item
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampusMarketplace;
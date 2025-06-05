import React, { useState, useEffect } from 'react';
import { Search, Plus, User, LogOut, Edit, Trash2, Check, X, MapPin, Sun, Moon } from 'lucide-react';
import UserDashboard from './UserDashboard'; // Ensure this path is correct
import { useDarkMode } from '../contexts/DarkModeContext.jsx'; // Corrected path and extension

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
    const [error, setError] = useState(null); // Centralized error state

    const { darkMode, toggleDarkMode } = useDarkMode(); // Use the dark mode hook

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
        image_file: null,
        contact_number: '',
        location: ''
    });

    // Edit item form data - image_file for new upload, location added
    const [editForm, setEditForm] = useState({
        title: '',
        price: '',
        category: 'Electronics',
        description: '',
        image_file: null,
        current_image_url: '',
        contact_number: '',
        location: '',
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

    // Helper function to format phone number for WhatsApp
    const formatPhoneNumberForWhatsApp = (number) => {
        if (!number) return '';
        let cleaned = number.replace(/\D/g, '');

        if (cleaned.startsWith('07') && cleaned.length === 10) {
            cleaned = '254' + cleaned.substring(1);
        } else if (cleaned.length === 9 && !cleaned.startsWith('254')) {
            cleaned = '254' + cleaned;
        } else if (cleaned.length === 12 && cleaned.startsWith('254')) {
            // Already good
        } else if (cleaned.startsWith('254')) {
            // Already good
        }

        if (cleaned.length < 9 || cleaned.length > 12) {
             return null;
        }

        return cleaned;
    };

    // Filter items based on search term and selected category
    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase()));
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

        const formattedContactNumber = formatPhoneNumberForWhatsApp(newItem.contact_number);
        if (!formattedContactNumber) {
            setError("Please enter a valid WhatsApp number (e.g., 0712345678 or 254712345678).");
            return;
        }

        const formData = new FormData();
        formData.append('title', newItem.title);
        formData.append('price', newItem.price);
        formData.append('category', newItem.category);
        formData.append('description', newItem.description);
        formData.append('contact_number', formattedContactNumber);
        formData.append('location', newItem.location);
        if (newItem.image_file) {
            formData.append('image_file', newItem.image_file);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to add item.');
            }

            const productsResponse = await fetch(`${API_BASE_URL}/products`);
            const productsData = await productsResponse.json();
            setItems(productsData);

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
            image_file: null,
            current_image_url: item.image_url,
            contact_number: item.contact_number,
            location: item.location,
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

        const formattedContactNumber = formatPhoneNumberForWhatsApp(editForm.contact_number);
        if (!formattedContactNumber) {
            setError("Please enter a valid WhatsApp number (e.g., 0712345678 or 254712345678).");
            return;
        }

        const formData = new FormData();
        formData.append('title', editForm.title);
        formData.append('price', editForm.price);
        formData.append('category', editForm.category);
        formData.append('description', editForm.description);
        formData.append('contact_number', formattedContactNumber);
        formData.append('location', editForm.location);
        formData.append('sold', editForm.sold);
        if (editForm.image_file) {
            formData.append('image_file', editForm.image_file);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/products/${editingItem.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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

            setEditingItem(null);
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

        // Prepare a JSON payload with the updated 'sold' status
        // IMPORTANT: Include all fields that your backend's PUT/update endpoint expects as required,
        // even if they are not changing, as many APIs require a full object for updates.
        const payload = {
            title: itemToToggle.title,
            price: itemToToggle.price,
            category: itemToToggle.category,
            description: itemToToggle.description,
            contact_number: itemToToggle.contact_number,
            location: itemToToggle.location,
            sold: !itemToToggle.sold, // This is the only field we're logically changing
            image_url: itemToToggle.image_url // Make sure this property exists on itemToToggle if your backend expects it
        };

        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json', // Crucial: Set Content-Type for JSON
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload) // Send JSON string
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Server error response data:", data); // Log for debugging
                throw new Error(data.message || `Failed to update item status. Server responded with: ${response.status}`);
            }

            // After successful update, re-fetch all products to get the latest state
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
        const cleanContact = sellerContact.replace(/\D/g, '');
        const message = encodeURIComponent(`Hey, is the "${itemTitle}" you're selling still available? I saw it on Chuka Black Market.`);
        const whatsappUrl = `https://wa.me/${cleanContact}?text=${message}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
            {/* Header section */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Main header row - Always flex-row to keep logo and actions on same line */}
                    <div className="flex justify-between items-center h-16 py-3"> {/* Adjusted classes here */}
                        {/* Logo/Title */}
                        <div className="flex items-center">
                            <h1 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">Chuka Black Market</h1>
                        </div>

                        {/* User actions / Auth & Dark Mode Toggle - Always flex-row */}
                        <div className="flex items-center space-x-2 sm:space-x-4"> {/* Adjusted classes here */}
                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDarkMode}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200 ease-in-out"
                                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            >
                                {darkMode ? (
                                    <Sun size={20} className="text-yellow-400" />
                                ) : (
                                    <Moon size={20} className="text-gray-600" />
                                )}
                            </button>

                            {currentUser ? (
                                <>
                                    <button
                                        onClick={() => setShowAddItem(true)}
                                        className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg flex items-center justify-center space-x-1 sm:space-x-2 hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 w-auto"
                                        title="Sell a New Item"
                                    >
                                        <Plus size={18}  /> {/* Adjusted icon sizing */}
                                        <span className="hidden sm:inline">Sell Item</span> {/* Hide text on smallest screens */}
                                    </button>
                                    <div className="flex items-center space-x-2 w-auto justify-center">
                                        <User size={18} className="text-gray-600 dark:text-gray-300 " />
                                        <span className="text-gray-700 dark:text-gray-200 font-medium text-sm sm:text-base truncate max-w-[70px] sm:max-w-[120px]">{currentUser.name}</span> {/* Smaller max-w for name */}
                                        <button
                                            onClick={handleLogout}
                                            className="text-red-600 hover:text-red-700 dark:hover:text-red-500 transition duration-200 ease-in-out transform hover:scale-105 p-1"
                                            title="Logout"
                                        >
                                            <LogOut size={18}  />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setShowAuth(true)}
                                        className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105"
                                        title="Login or Sign Up"
                                    >
                                        Login / Sign Up
                                    </button>
                                    {/* The info text is now hidden on all but large screens to save space */}
                                    <p className="text-gray-600 dark:text-gray-400 text-xs hidden lg:block">
                                        (Sign up or Login to list your items!)
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Error message display */}
                {error && (
                    <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg relative mb-6 text-sm sm:text-base" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {error}</span>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
                            <X size={10} className="cursor-pointer" onClick={() => setError(null)} />
                        </span>
                    </div>
                )}

                {/* Search and Filter section */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search items by title, description, or location..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-sm sm:text-base dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full md:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-sm sm:text-base dark:text-gray-100"
                        >
                            {categories.map(category => (
                                <option key={category} value={category} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
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
                        setEditingItem={startEditingItem}
                        handleDeleteItem={handleDeleteItem}
                        handleMarkSold={handleMarkSold}
                        setShowAddItem={setShowAddItem}
                    />
                )}

                {/* All Available Items Grid */}
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6">Available Items</h2>
                {loading ? (
                    <div className="text-center py-6 sm:py-12 col-span-full">
                        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">Loading items...</p>
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                <div className="relative">
                                    <img
                                        src={item.image_url || `https://placehold.co/300x200/cccccc/333333/ffffff/ffffff?text=No+Image`}
                                        alt={item.title}
                                        className="w-full h-40 sm:h-48 object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/cccccc/333333/ffffff/ffffff?text=No+Image`; }}
                                    />
                                    {item.sold && (
                                        <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 rounded-md text-xs font-semibold">
                                            SOLD
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 sm:p-4">
                                    <h3 className="font-semibold text-base sm:text-lg mb-1 text-gray-900 dark:text-gray-100 truncate">{item.title}</h3>
                                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">KSh {item.price}</p>
                                    <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm mb-2 line-clamp-3">{item.description}</p>
                                    <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">
                                        <MapPin size={14} className="mr-1 text-gray-400 dark:text-gray-500" />
                                        <span>{item.location}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-3 space-y-1 sm:space-y-0">
                                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs font-medium">{item.category}</span>
                                        <span>by <span className="font-medium text-gray-700 dark:text-gray-200">{item.seller_name}</span></span>
                                    </div>
                                    {!item.sold && item.contact_number ? (
                                        <button
                                            onClick={() => handleContactSeller(item.title, item.contact_number)}
                                            className="w-full mt-3 sm:mt-4 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center space-x-2 text-sm sm:text-base"
                                        >
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-4 h-4 sm:w-5 sm:h-5" />
                                            <span>Contact Seller</span>
                                        </button>
                                    ) : (
                                        !item.sold && !item.contact_number && (
                                            <p className="w-full mt-3 sm:mt-4 text-center text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Seller contact not available.</p>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 sm:py-12 col-span-full">
                        <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">No items found matching your search or filters.</p>
                    </div>
                )}
            </main>

            {/* Authentication Modal (Login/Sign Up) */}
            {showAuth && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg text-gray-900 dark:text-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                                {authMode === 'login' ? 'Login' : 'Sign Up'}
                            </h2>
                            <button
                                onClick={() => setShowAuth(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200"
                                title="Close"
                            >
                                <X size={18}/>
                            </button>
                        </div>
                        <form onSubmit={handleAuth}>
                            {authMode === 'signup' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={authData.name}
                                        onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                    />
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={authData.email}
                                    onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={authData.password}
                                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 text-sm mb-4"
                            >
                                {authMode === 'login' ? 'Login' : 'Sign Up'}
                            </button>
                            <p className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                        setError(null);
                                    }}
                                    className="text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 font-medium"
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg text-gray-900 dark:text-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Add New Item</h2>
                            <button
                                onClick={() => setShowAddItem(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200"
                                title="Close"
                            >
                                <X size={10} className="sm:size-24" />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.title}
                                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (KSh)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={newItem.price}
                                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                <select
                                    required
                                    value={newItem.category}
                                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                >
                                    {categories.filter(c => c !== 'all').map(cat => (
                                        <option key={cat} value={cat} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    required
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none resize-y bg-white dark:bg-gray-700 text-sm"
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    required
                                    onChange={(e) => setNewItem({ ...newItem, image_file: e.target.files[0] })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 file:dark:bg-blue-800 file:dark:text-blue-100 hover:file:bg-blue-100 hover:file:dark:bg-blue-700 text-sm"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.location}
                                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                    placeholder="e.g., Main Campus, Hostel Block B"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number (WhatsApp)</label>
                                <input
                                    type="tel"
                                    required
                                    value={newItem.contact_number}
                                    onChange={(e) => setNewItem({ ...newItem, contact_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                    placeholder="e.g., 0712345678 or 254712345678"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Please include country code if not starting with 07.</p>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 text-sm"
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg text-gray-900 dark:text-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Edit Item</h2>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-200"
                                title="Close"
                            >
                                <X size={10} className="sm:size-24" />
                            </button>
                        </div>
                        <form onSubmit={handleEditItem}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (KSh)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={editForm.price}
                                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                <select
                                    required
                                    value={editForm.category}
                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                >
                                    {categories.filter(c => c !== 'all').map(cat => (
                                        <option key={cat} value={cat} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    required
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none resize-y bg-white dark:bg-gray-700 text-sm"
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Image</label>
                                {editForm.current_image_url && (
                                    <img src={editForm.current_image_url} alt="Current Product" className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-md mb-2" />
                                )}
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Replace Image (Optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEditForm({ ...editForm, image_file: e.target.files[0] })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 file:dark:bg-blue-800 file:dark:text-blue-100 hover:file:bg-blue-100 hover:file:dark:bg-blue-700 text-sm"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.location}
                                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                    placeholder="e.g., Main Campus, Hostel Block B"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number (WhatsApp)</label>
                                <input
                                    type="tel"
                                    required
                                    value={editForm.contact_number}
                                    onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none bg-white dark:bg-gray-700 text-sm"
                                    placeholder="e.g., 0712345678 or 254712345678"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Please include country code if not starting with 07.</p>
                            </div>
                            <div className="mb-6 flex items-center">
                                <input
                                    type="checkbox"
                                    id="soldCheckbox"
                                    checked={editForm.sold}
                                    onChange={(e) => setEditForm({ ...editForm, sold: e.target.checked })}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="soldCheckbox" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">Mark as Sold</label>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 text-sm"
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
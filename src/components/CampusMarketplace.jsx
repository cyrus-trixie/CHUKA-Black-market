import React, { useState, useEffect } from 'react';
import { Search, Plus, User, LogOut, Edit, Trash2, Check, X } from 'lucide-react';
import UserDashboard from './UserDashboard'; // Correct import for the separate UserDashboard component

// In CampusMarketplace.jsx
const API_BASE_URL = 'https://chuka-black-market.onrender.com/api';  // Define your backend API base URL

const CampusMarketplace = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showAddItem, setShowAddItem] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [items, setItems] = useState([]); // Initialize items as an empty array, will be fetched from backend
  const [loading, setLoading] = useState(true); // Loading state for fetching items
  const [error, setError] = useState(null); // Error state for API calls

  const categories = ['all', 'Electronics', 'Books', 'Clothing', 'Furniture', 'Other'];

  // Auth form data
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    name: ''
  });

  // Add item form data
  const [newItem, setNewItem] = useState({
    title: '',
    price: '',
    category: 'Electronics',
    description: '',
    image_url: '', // Changed to image_url to match backend
    contact_number: '' // Changed to contact_number to match backend
  });

  // Effect to load user from localStorage on initial render
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setCurrentUser(JSON.parse(storedUser));
      // In a real app, you might want to verify the token's validity here with a backend call
    }
  }, []);

  // Effect to fetch products from the backend
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
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
  }, []); // Empty dependency array means this runs once on mount

  // Filter items based on search term and selected category
  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get user's items: This now correctly filters items only if a user is logged in.
  const userItems = currentUser
    ? items.filter(item => item.seller_id === currentUser.id)
    : [];

  // Helper function to get auth headers
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
    setError(null); // Clear previous errors
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
    // Optionally re-fetch public products if needed, or just clear user-specific data
    // For simplicity, we'll let the main product list remain as is, but user dashboard will clear.
  };

  // Handle adding a new item
  const handleAddItem = async (e) => {
    e.preventDefault();
    setError(null);
    if (!currentUser) {
      setError("You must be logged in to add an item.");
      return;
    }

    if (!newItem.title || !newItem.price || !newItem.description || !newItem.contact_number) {
      setError("Please fill in all required fields (Title, Price, Description, Contact Number).");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newItem,
          price: parseFloat(newItem.price) // Ensure price is a number
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add item.');
      }

      // After successful add, re-fetch all products to update the list
      const productsResponse = await fetch(`${API_BASE_URL}/products`);
      const productsData = await productsResponse.json();
      setItems(productsData);

      // Corrected: Ensure the newItem state is fully reset
      setNewItem({ title: '', price: '', category: 'Electronics', description: '', image_url: '', contact_number: '' });
      setShowAddItem(false);
    } catch (err) {
      console.error('Error adding product:', err);
      setError(err.message || 'An error occurred while adding the product.');
    }
  };

  // Handle editing an existing item
  const handleEditItem = async (e) => {
    e.preventDefault();
    setError(null);

    if (!editingItem.title || !editingItem.price || !editingItem.description || !editingItem.contact_number) {
      setError("Please fill in all required fields (Title, Price, Description, Contact Number).");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/products/${editingItem.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...editingItem,
          price: parseFloat(editingItem.price) // Ensure price is a number
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update item.');
      }

      // After successful edit, re-fetch all products to update the list
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

      // After successful delete, re-fetch all products to update the list
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
    // Find the item to toggle its sold status
    const itemToToggle = items.find(item => item.id === id);
    if (!itemToToggle) return;

    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT', // Use PUT for updates
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...itemToToggle, // Send existing item data
          sold: !itemToToggle.sold // Toggle the sold status
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update item status.');
      }

      // After successful update, re-fetch all products to update the list
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
    // Ensure the contact number is clean (digits only, no +, spaces, or dashes)
    const cleanContact = sellerContact.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`Hey, is the "${itemTitle}" you're selling still available? I saw it on Chuka Black Market.`);
    const whatsappUrl = `https://wa.me/${cleanContact}?text=${message}`;
    window.open(whatsappUrl, '_blank'); // Open in a new tab
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header section */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">Chuka Black Market</h1> {/* App Name */}
            </div>

            <div className="flex items-center space-x-4">
              {currentUser ? (
                // Display "Sell Item" button and user info if logged in
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
                // Display "Login / Sign Up" button if not logged in
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
                placeholder="Search items by title or description..."
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
            currentUser={currentUser} // Pass currentUser to display their name
            userItems={userItems} // Pass filtered user items
            setItems={setItems} // Allows UserDashboard to modify the main items state
            setEditingItem={setEditingItem} // Allows UserDashboard to trigger the edit modal
            handleDeleteItem={handleDeleteItem} // Allows UserDashboard to delete items
            handleMarkSold={handleMarkSold} // Allows UserDashboard to mark items as sold/available
            setShowAddItem={setShowAddItem} // Pass the setShowAddItem function
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
                    src={item.image_url || `https://placehold.co/300x200/cccccc/333333`} // Simplified placeholder URL
                    alt={item.title}
                    className="w-full h-48 object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/cccccc/333333`; }} // Simplified fallback image
                  />
                  {item.sold && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-semibold">
                      SOLD
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1 text-gray-900 truncate">{item.title}</h3>
                  <p className="text-2xl font-bold text-blue-600 mb-2">KSh {item.price}</p> {/* Currency */}
                  <p className="text-gray-600 text-sm mb-2 line-clamp-3">{item.description}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500 mt-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">{item.category}</span>
                    <span>by <span className="font-medium text-gray-700">{item.seller_name}</span></span> {/* Display seller_name from backend */}
                  </div>
                  {/* Contact Seller Button - Visible to anyone if item is not sold and contact exists */}
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
                    onChange={(e) => setAuthData({...authData, name: e.target.value})}
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
                  onChange={(e) => setAuthData({...authData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authData.password}
                  onChange={(e) => setAuthData({...authData, password: e.target.value})}
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
                    setError(null); // Clear errors when switching mode
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
                  onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (KSh)</label> {/* Currency */}
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {categories.slice(1).map(category => ( // slice(1) to exclude 'all' category from add item
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  value={newItem.description}
                  onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Seller Contact (WhatsApp Number, e.g., 2547XXXXXXXX)</label>
                <input
                  type="tel" // Use type="tel" for phone numbers
                  required
                  value={newItem.contact_number} // Changed to contact_number
                  onChange={(e) => setNewItem({...newItem, contact_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., 254712345678"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input
                  type="url"
                  value={newItem.image_url} // Changed to image_url
                  onChange={(e) => setNewItem({...newItem, image_url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({...editingItem, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (KSh)</label> {/* Currency */}
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={editingItem.price}
                  onChange={(e) => setEditingItem({...editingItem, price: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {categories.slice(1).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Seller Contact (WhatsApp Number)</label>
                <input
                  type="tel" // Use type="tel" for phone numbers
                  required
                  value={editingItem.contact_number} // Changed to contact_number
                  onChange={(e) => setEditingItem({...editingItem, contact_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., 254712345678"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input
                  type="url"
                  value={editingItem.image_url} // Changed to image_url
                  onChange={(e) => setEditingItem({...editingItem, image_url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
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

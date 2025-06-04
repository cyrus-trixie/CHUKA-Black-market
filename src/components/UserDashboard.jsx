import React from 'react';
import { Edit, Trash2, Check, X, MapPin } from 'lucide-react'; // Added MapPin icon

// This component displays a user's listed items and provides actions (edit, delete, mark sold).
// It receives the items to display and functions to handle item actions as props.
const UserDashboard = ({ userItems, setItems, setEditingItem, handleDeleteItem, handleMarkSold }) => {
    return (
        <div className="mb-8 bg-white rounded-lg shadow-sm border p-6">
            {/* Heading for the dashboard section, showing the count of listed items */}
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Dashboard: My Listings ({userItems.length})</h2>
            {userItems.length === 0 ? (
                // Message displayed when there are no items listed by the current user
                <p className="text-gray-500">You haven't listed any items yet. Click "Sell Item" in the header to get started!</p>
            ) : (
                // Grid layout for displaying the user's listed items
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userItems.map(item => (
                        // Individual item card for each listed item
                        <div key={item.id} className="border border-gray-200 rounded-lg p-4 relative bg-white">
                            {item.sold && (
                                // "SOLD" badge displayed if the item is marked as sold
                                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-md text-xs font-semibold">
                                    SOLD
                                </div>
                            )}
                            {/* Item image with a fallback in case the image URL is broken */}
                            <img
                                src={item.image_url || `https://placehold.co/300x200/cccccc/333333?text=Image+Not+Found`} // Changed to item.image_url
                                alt={item.title}
                                className="w-full h-32 object-cover rounded-md mb-3"
                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/300x200/cccccc/333333?text=Image+Not+Found`; }} // Fallback image
                            />
                            {/* Item title */}
                            <h3 className="font-semibold text-lg text-gray-900 truncate">{item.title}</h3>
                            {/* Item price in KSh */}
                            <p className="text-blue-600 font-bold text-xl mb-2">KSh {item.price}</p>
                            {/* Item description, truncated to 2 lines for cleaner display */}
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                            {/* Item Location */}
                            <div className="flex items-center text-sm text-gray-500 mb-3">
                                <MapPin size={16} className="mr-1 text-gray-400" />
                                <span>{item.location}</span>
                            </div>
                            {/* Action buttons for editing, deleting, and marking as sold/available */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setEditingItem(item)} // Sets the item to be edited in the parent component's state
                                    className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 transition duration-200"
                                    title="Edit Item"
                                >
                                    <Edit size={18} />
                                </button>
                                <button
                                    onClick={() => handleDeleteItem(item.id)} // Calls the delete function in the parent component
                                    className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition duration-200"
                                    title="Delete Item"
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button
                                    onClick={() => handleMarkSold(item.id)} // Calls the mark sold/available function in the parent component
                                    className={`${item.sold ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'} p-1 rounded-full hover:bg-opacity-20 transition duration-200`}
                                    title={item.sold ? "Mark as Available" : "Mark as Sold"}
                                >
                                    {item.sold ? <X size={18} /> : <Check size={18} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
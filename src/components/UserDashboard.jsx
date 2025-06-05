import React from 'react';
import { Plus } from 'lucide-react';
import { useDarkMode } from "../contexts/DarkModeContext"; // <--- Add two dots and a slash // Import useDarkMode hook (if needed, otherwise can be removed if not used directly)

const UserDashboard = ({ currentUser, userItems, setEditingItem, handleDeleteItem, handleMarkSold, setShowAddItem }) => {
    // const { darkMode } = useDarkMode(); // Uncomment if you need direct dark mode state in this component

    if (!currentUser) {
        return null;
    }

    return (
        <div className="mb-8 sm:mb-10 p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Your Listings</h2>
                <button
                    onClick={() => setShowAddItem(true)}
                    className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg flex items-center justify-center space-x-1 sm:space-x-2 hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 w-full sm:w-auto"
                >
                    <Plus size={18} />
                    <span>List New Item</span>
                </button>
            </div>

            {userItems.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-base sm:text-lg mb-3 sm:mb-4">You haven't listed any items yet.</p>
                    <button
                        onClick={() => setShowAddItem(true)}
                        className="bg-green-500 text-white px-5 py-2.5 text-sm rounded-lg hover:bg-green-600 transition duration-200 ease-in-out transform hover:scale-105"
                    >
                        Start Selling Now!
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full bg-white dark:bg-gray-800">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs sm:text-sm leading-normal">
                                <th className="py-2 px-3 sm:py-3 sm:px-6 text-left">Item</th>
                                <th className="py-2 px-3 sm:py-3 sm:px-6 text-left">Price</th>
                                <th className="py-2 px-3 sm:py-3 sm:px-6 text-center">Status</th>
                                <th className="py-2 px-3 sm:py-3 sm:px-6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-light">
                            {userItems.map(item => (
                                <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="py-2 px-3 sm:py-3 sm:px-6 text-left whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img
                                                src={item.image_url || `https://placehold.co/32x32/cccccc/333333/ffffff/ffffff?text=No+Image`}
                                                alt={item.title}
                                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-md mr-2 sm:mr-3 object-cover"
                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/32x32/cccccc/333333/ffffff/ffffff?text=No+Image`; }}
                                            />
                                            <span className="font-medium truncate max-w-[100px] sm:max-w-[150px]">{item.title}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 sm:py-3 sm:px-6 text-left whitespace-nowrap">KSh {item.price}</td>
                                    <td className="py-2 px-3 sm:py-3 sm:px-6 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                            item.sold ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                        }`}>
                                            {item.sold ? 'Sold' : 'Available'}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 sm:py-3 sm:px-6 text-center">
                                        <div className="flex flex-col sm:flex-row item-center justify-center space-y-1 sm:space-y-0 sm:space-x-2">
                                            <button
                                                onClick={() => setEditingItem(item)}
                                                className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 font-medium px-2 py-1 rounded-md border border-blue-600 dark:border-blue-500 hover:border-blue-800 dark:hover:border-blue-400 transition duration-200 text-xs sm:text-sm"
                                                title="Edit Item"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleMarkSold(item.id)}
                                                className={`font-medium px-2 py-1 rounded-md border transition duration-200 text-xs sm:text-sm ${
                                                    item.sold
                                                        ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
                                                        : 'bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600'
                                                }`}
                                                title={item.sold ? "Mark as Available" : "Mark as Sold"}
                                            >
                                                {item.sold ? 'Mark Available' : 'Mark Sold'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="text-red-600 hover:text-red-800 dark:hover:text-red-400 font-medium px-2 py-1 rounded-md border border-red-600 dark:border-red-500 hover:border-red-800 dark:hover:border-red-400 transition duration-200 text-xs sm:text-sm"
                                                title="Delete Item"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
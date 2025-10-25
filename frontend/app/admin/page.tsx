'use client';

import React, { useState } from 'react';
import { FolderPlus, CheckCircle, AlertCircle } from 'lucide-react';
import { IPFSService } from '../services/ipfs';

export default function AdminPage() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initializeFolder = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const ipfsService = new IPFSService();
      const url = await ipfsService.initializeAgentsFolder();
      
      setFolderUrl(url);
      console.log('Agents folder initialized:', url);
    } catch (err) {
      console.error('Error initializing folder:', err);
      setError('Failed to initialize agents folder');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <FolderPlus className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Initialize Agents Folder
          </h1>
          <p className="text-gray-600">
            Create a dedicated folder on IPFS for storing all agent records.
          </p>
        </div>

        {!folderUrl && !error && (
          <button
            onClick={initializeFolder}
            disabled={isInitializing}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isInitializing ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4 mr-2" />
                Initialize Folder
              </>
            )}
          </button>
        )}

        {folderUrl && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center mb-2">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-green-800">
                Folder Initialized Successfully!
              </h3>
            </div>
            <p className="text-sm text-green-700 mb-2">
              Your agents folder is ready. Save this URL for reference:
            </p>
            <div className="bg-white p-2 rounded border">
              <code className="text-xs text-gray-800 break-all">
                {folderUrl}
              </code>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              You can now register agents and they will be stored in this folder.
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center mb-2">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-red-800">
                Initialization Failed
              </h3>
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

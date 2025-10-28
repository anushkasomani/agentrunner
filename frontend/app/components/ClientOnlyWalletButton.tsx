'use client';

import React, { useState, useEffect } from 'react';
import { WalletMultiButton, WalletDisconnectButton } from './WalletProvider';
import { useWallet } from '@solana/wallet-adapter-react';

interface ClientOnlyWalletButtonProps {
  className?: string;
  style?: React.CSSProperties;
  isMobile?: boolean;
}

export default function ClientOnlyWalletButton({ 
  className, 
  style, 
  isMobile = false 
}: ClientOnlyWalletButtonProps) {
  const { connected } = useWallet();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render anything on the server or before mounting
  if (!isMounted) {
    return (
      <div className={className} style={style}>
        <div className="wallet-adapter-button wallet-adapter-button-trigger">
          <div className="wallet-adapter-button-start-icon">
            <i className="wallet-adapter-button-start-icon"></i>
          </div>
          <span>Select Wallet</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <WalletMultiButton 
        className={className}
        style={style}
      />
      {connected && (
        <div className={isMobile ? "mt-2" : "ml-2"}>
          <WalletDisconnectButton 
            className={isMobile 
              ? "!w-full !bg-red-500 hover:!bg-red-600 !rounded-lg !px-4 !py-2 !text-white !text-sm !font-medium"
              : "!bg-red-500 hover:!bg-red-600 !rounded-lg !px-3 !py-1 !text-white !text-xs !font-medium"
            }
          />
        </div>
      )}
    </>
  );
}

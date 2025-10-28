#!/usr/bin/env python3
"""
Startup script to run all API services
"""
import subprocess
import time
import os
import sys
from multiprocessing import Process

def run_service(script_name, port, service_name):
    """Run a service in a subprocess"""
    try:
        print(f"Starting {service_name} on port {port}...")
        subprocess.run([
            sys.executable, script_name,
            "--host", "0.0.0.0",
            "--port", str(port),
            "--reload"
        ])
    except KeyboardInterrupt:
        print(f"Stopping {service_name}...")
    except Exception as e:
        print(f"Error starting {service_name}: {e}")

def main():
    """Start all services"""
    services = [
        ("app/main.py", 8000, "Crypto OHLCV API"),
        ("app/research_agent.py", 8001, "Research Agent"),
        ("app/blog_agent.py", 8002, "Blog Agent"),
        ("app/tweet_agent.py", 8003, "Tweet Agent"),
        ("app/image_agent.py", 8004, "Image Agent"),
        ("app/script_agent.py", 8005, "Script Agent"),
    ]
    
    processes = []
    
    try:
        for script, port, name in services:
            p = Process(target=run_service, args=(script, port, name))
            p.start()
            processes.append(p)
            time.sleep(1)  # Stagger startup
        
        print("\nAll services started!")
        print("Services running on:")
        for script, port, name in services:
            print(f"  {name}: http://localhost:{port}")
        
        print("\nPress Ctrl+C to stop all services...")
        
        # Wait for all processes
        for p in processes:
            p.join()
            
    except KeyboardInterrupt:
        print("\nShutting down all services...")
        for p in processes:
            p.terminate()
            p.join()
        print("All services stopped.")

if __name__ == "__main__":
    main()

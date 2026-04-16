/**
 * API Configuration Constants
 * 
 * Configure the API base URL based on your development/production environment:
 * 
 * Android Emulator:  http://10.0.2.2:5000/api
 * iOS Simulator:     http://localhost:5000/api
 * Physical Device:   http://<YOUR_MACHINE_IP>:5000/api (e.g., http://192.168.1.100:5000/api)
 * Production:        https://api.fixora.com/api
 */

/**
 * API Base URL - Update this based on your environment
 */
export const API_BASE_URL = 'http://10.0.2.2:5000/api'; // Default: Android emulator

/**
 * API Request Timeout (in milliseconds)
 */
export const API_TIMEOUT = 15000;

export default {
  API_BASE_URL,
  API_TIMEOUT,
};

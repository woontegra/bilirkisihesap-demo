import axios from 'axios';

interface SaveCalculationParams {
  endpoint: string;
  data: any;
  id?: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

interface LoadCalculationParams {
  endpoint: string;
  id: string;
  onError?: (message: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Saves a calculation to the server
 * @param endpoint The API endpoint to save to (e.g., 'kidem/30isci')
 * @param data The calculation data to save
 * @param id Optional ID for updating existing calculations
 * @param onSuccess Success callback function
 * @param onError Error callback function
 * @returns The saved calculation ID
 */
export const saveCalculation = async ({ 
  endpoint, 
  data, 
  id,
  onSuccess,
  onError
}: SaveCalculationParams): Promise<string> => {
  try {
    const url = id 
      ? `${API_URL}/${endpoint}/${id}`
      : `${API_URL}/${endpoint}`;
    
    const method = id ? 'put' : 'post';
    
    const response = await axios[method](url, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    if (onSuccess) {
      onSuccess('Hesaplama başarıyla kaydedildi.');
    }

    return response.data.id || id || '';
  } catch (error) {
    console.error('Hesaplama kaydedilirken hata oluştu:', error);
    
    if (onError) {
      onError('Hesaplama kaydedilirken bir hata oluştu. Lütfen tekrar deneyiniz.');
    }
    
    throw error;
  }
};

/**
 * Loads a saved calculation from the server
 * @param endpoint The API endpoint to load from (e.g., 'kidem/30isci')
 * @param id The ID of the calculation to load
 * @param onError Error callback function
 * @returns The loaded calculation data
 */
export const loadCalculation = async ({ 
  endpoint, 
  id,
  onError
}: LoadCalculationParams): Promise<any> => {
  try {
    const response = await axios.get(`${API_URL}/${endpoint}/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Hesaplama yüklenirken hata oluştu:', error);
    
    if (onError) {
      onError('Hesaplama yüklenirken bir hata oluştu. Lütfen tekrar deneyiniz.');
    }
    
    throw error;
  }
};

/**
 * Deletes a saved calculation
 * @param endpoint The API endpoint (e.g., 'kidem/30isci')
 * @param id The ID of the calculation to delete
 * @param onSuccess Success callback function
 * @param onError Error callback function
 */
export const deleteCalculation = async (
  endpoint: string, 
  id: string,
  onSuccess?: (message: string) => void,
  onError?: (message: string) => void
): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/${endpoint}/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    if (onSuccess) {
      onSuccess('Hesaplama başarıyla silindi.');
    }
  } catch (error) {
    console.error('Hesaplama silinirken hata oluştu:', error);
    
    if (onError) {
      onError('Hesaplama silinirken bir hata oluştu. Lütfen tekrar deneyiniz.');
    }
    
    throw error;
  }
};

/**
 * Lists all saved calculations for a specific endpoint
 * @param endpoint The API endpoint (e.g., 'kidem/30isci')
 * @param onError Error callback function
 * @returns Array of saved calculations
 */
export const listCalculations = async (
  endpoint: string,
  onError?: (message: string) => void
): Promise<any[]> => {
  try {
    const response = await axios.get(`${API_URL}/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });

    return response.data || [];
  } catch (error) {
    console.error('Hesaplamalar yüklenirken hata oluştu:', error);
    
    if (onError) {
      onError('Hesaplamalar yüklenirken bir hata oluştu. Lütfen tekrar deneyiniz.');
    }
    
    return [];
  }
};

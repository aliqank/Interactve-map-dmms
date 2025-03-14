import { Injectable } from '@angular/core';

export interface FavoritePolygon {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number; }[];
  createdAt: string;
}

export interface ApiSettings {
  apiUrl: string;
  bearerId: string;
  trackerId: string;
}

export interface ModalPosition {
  left: string;
  top: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly POLYGON_COORDINATES_KEY = 'polygonCoordinates';
  private readonly SELECTED_MAP_LAYER_KEY = 'selectedMapLayer';
  private readonly API_SETTINGS_KEY = 'apiSettings';
  private readonly FAVORITE_POLYGONS_KEY = 'favoritePolygons';
  private readonly CURRENT_POLYGON_ID_KEY = 'currentPolygonId';
  private readonly MODAL_POSITIONS_KEY = 'modalPositions';

  constructor() { }

  /**
   * Save polygon coordinates to local storage
   * @param coordinates The coordinates to save
   */
  savePolygonCoordinates(coordinates: { lat: number; lng: number; }[]): void {
    localStorage.setItem(this.POLYGON_COORDINATES_KEY, JSON.stringify(coordinates));
  }

  /**
   * Load polygon coordinates from local storage
   * @returns The loaded coordinates or null if not found
   */
  loadPolygonCoordinates(): { lat: number; lng: number; }[] | null {
    const savedPolygon = localStorage.getItem(this.POLYGON_COORDINATES_KEY);
    if (savedPolygon) {
      try {
        return JSON.parse(savedPolygon);
      } catch (error) {
        console.error('Error parsing saved polygon coordinates:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Save the selected map layer to local storage
   * @param layer The layer to save
   */
  saveSelectedMapLayer(layer: string): void {
    localStorage.setItem(this.SELECTED_MAP_LAYER_KEY, layer);
  }

  /**
   * Load the selected map layer from local storage
   * @returns The loaded layer or null if not found
   */
  loadSelectedMapLayer(): string | null {
    return localStorage.getItem(this.SELECTED_MAP_LAYER_KEY);
  }

  /**
   * Save API settings to local storage
   * @param settings The settings to save
   */
  saveApiSettings(settings: ApiSettings): void {
    localStorage.setItem(this.API_SETTINGS_KEY, JSON.stringify(settings));
  }

  /**
   * Load API settings from local storage
   * @returns The loaded settings or null if not found
   */
  loadApiSettings(): ApiSettings | null {
    const savedSettings = localStorage.getItem(this.API_SETTINGS_KEY);
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (error) {
        console.error('Error parsing saved API settings:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Save favorite polygons to local storage
   * @param favorites The favorites to save
   */
  saveFavoritePolygons(favorites: FavoritePolygon[]): void {
    localStorage.setItem(this.FAVORITE_POLYGONS_KEY, JSON.stringify(favorites));
  }

  /**
   * Load favorite polygons from local storage
   * @returns The loaded favorites or an empty array if not found
   */
  loadFavoritePolygons(): FavoritePolygon[] {
    const savedFavorites = localStorage.getItem(this.FAVORITE_POLYGONS_KEY);
    if (savedFavorites) {
      try {
        return JSON.parse(savedFavorites);
      } catch (error) {
        console.error('Error parsing saved favorite polygons:', error);
        return [];
      }
    }
    return [];
  }

  /**
   * Save the current polygon ID to local storage
   * @param id The ID to save
   */
  saveCurrentPolygonId(id: string | null): void {
    if (id) {
      localStorage.setItem(this.CURRENT_POLYGON_ID_KEY, id);
    } else {
      localStorage.removeItem(this.CURRENT_POLYGON_ID_KEY);
    }
  }

  /**
   * Load the current polygon ID from local storage
   * @returns The loaded ID or null if not found
   */
  loadCurrentPolygonId(): string | null {
    return localStorage.getItem(this.CURRENT_POLYGON_ID_KEY);
  }

  /**
   * Save modal positions to local storage
   * @param positions The positions to save
   */
  saveModalPositions(positions: { [key: string]: ModalPosition }): void {
    localStorage.setItem(this.MODAL_POSITIONS_KEY, JSON.stringify(positions));
  }

  /**
   * Load modal positions from local storage
   * @returns The loaded positions or an empty object if not found
   */
  loadModalPositions(): { [key: string]: ModalPosition } {
    const savedPositions = localStorage.getItem(this.MODAL_POSITIONS_KEY);
    if (savedPositions) {
      try {
        return JSON.parse(savedPositions);
      } catch (error) {
        console.error('Error parsing saved modal positions:', error);
        return {};
      }
    }
    return {};
  }

  /**
   * Clear all data from local storage
   */
  clearAll(): void {
    localStorage.removeItem(this.POLYGON_COORDINATES_KEY);
    localStorage.removeItem(this.SELECTED_MAP_LAYER_KEY);
    localStorage.removeItem(this.API_SETTINGS_KEY);
    localStorage.removeItem(this.FAVORITE_POLYGONS_KEY);
    localStorage.removeItem(this.CURRENT_POLYGON_ID_KEY);
    localStorage.removeItem(this.MODAL_POSITIONS_KEY);
  }
} 
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ApiSettings } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  constructor(private http: HttpClient) { }

  /**
   * Send coordinates to the API
   * @param settings The API settings
   * @param latitude The latitude
   * @param longitude The longitude
   * @param timeoutMs The timeout in milliseconds
   * @returns An observable of the API response
   */
  sendCoordinates(
    settings: ApiSettings,
    latitude: number,
    longitude: number,
    timeoutMs: number = this.DEFAULT_TIMEOUT
  ): Observable<any> {
    if (!settings.apiUrl || !settings.bearerId || !settings.trackerId) {
      return throwError(() => new Error('API settings are incomplete'));
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.bearerId}`
    });

    const body = {
      trackerId: settings.trackerId,
      latitude: latitude,
      longitude: longitude,
      timestamp: new Date().toISOString()
    };

    return this.http.post(settings.apiUrl, body, { headers })
      .pipe(
        timeout(timeoutMs),
        catchError(error => {
          if (error.name === 'TimeoutError') {
            return throwError(() => new Error('Request timed out'));
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Search for a location by name using the Nominatim API
   * @param query The search query
   * @returns An observable of the search results
   */
  searchLocation(query: string): Observable<any[]> {
    if (!query || query.trim().length < 3) {
      return of([]);
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5`;

    return this.http.get<any[]>(url)
      .pipe(
        timeout(this.DEFAULT_TIMEOUT),
        catchError(error => {
          console.error('Error searching for location:', error);
          return of([]);
        })
      );
  }

  /**
   * Search for a location by coordinates using the Nominatim API
   * @param lat The latitude
   * @param lng The longitude
   * @returns An observable of the search result
   */
  reverseGeocode(lat: number, lng: number): Observable<any> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    return this.http.get<any>(url)
      .pipe(
        timeout(this.DEFAULT_TIMEOUT),
        catchError(error => {
          console.error('Error reverse geocoding:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Validate API settings by making a test request
   * @param settings The API settings to validate
   * @returns An observable of the validation result
   */
  validateApiSettings(settings: ApiSettings): Observable<boolean> {
    if (!settings.apiUrl || !settings.bearerId || !settings.trackerId) {
      return of(false);
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.bearerId}`
    });

    // Just check if the API endpoint is reachable with a HEAD request
    return this.http.head(settings.apiUrl, { headers })
      .pipe(
        timeout(this.DEFAULT_TIMEOUT),
        catchError(error => {
          console.error('Error validating API settings:', error);
          return of(false);
        }),
        // If no error, return true
        _ => of(true)
      );
  }
} 
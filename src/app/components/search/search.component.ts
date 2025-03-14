import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { MapService } from '../../services/map.service';
import { ToastService } from '../../services/toast.service';
import * as L from 'leaflet';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() map!: L.Map;
  @Output() visibilityChange = new EventEmitter<boolean>();
  
  searchQuery = '';
  coordinatesQuery = '';
  searchResults: any[] = [];
  isSearching = false;
  private searchSubject = new Subject<string>();
  private searchSubscription: Subscription | null = null;
  private markers: L.Marker[] = [];

  constructor(
    private apiService: ApiService,
    private mapService: MapService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    if (!this.map) {
      this.map = this.mapService.getMap();
    }
    
    // Setup search debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.trim().length > 2) {
        this.performSearch(query);
      } else {
        this.searchResults = [];
      }
    });
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in the isVisible input
    if (changes['isVisible'] && !changes['isVisible'].firstChange) {
      // Handle visibility changes if needed
    }
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    this.clearMarkers();
  }
  
  /**
   * Toggle visibility of the component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChange.emit(this.isVisible);
  }

  /**
   * Handle search input changes
   */
  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  /**
   * Clear the search query and results
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.clearMarkers();
  }

  /**
   * Clear the coordinates query
   */
  clearCoordinates(): void {
    this.coordinatesQuery = '';
  }

  /**
   * Perform a search for a location
   * @param query The search query
   */
  private performSearch(query: string): void {
    this.isSearching = true;
    this.apiService.searchLocation(query).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Error searching for location:', error);
        this.isSearching = false;
        this.toastService.error('Error searching for location');
      }
    });
  }

  /**
   * Go to a location on the map
   * @param result The search result
   */
  goToLocation(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    if (isNaN(lat) || isNaN(lng)) {
      this.toastService.error('Invalid coordinates in search result');
      return;
    }
    
    // Clear existing marker
    this.clearMarkers();
    
    // Add a new marker
    const map = this.mapService.getMap();
    const marker = L.marker([lat, lng], {
      icon: this.mapService.getSearchIcon()
    }).addTo(map);
    
    // Add a popup with the location name
    marker.bindPopup(result.display_name).openPopup();
    
    // Pan to the location
    this.mapService.panTo(lat, lng, 14);
    
    // Clear the search results
    this.searchResults = [];
  }

  /**
   * Search for a location by coordinates
   */
  searchByCoordinates(): void {
    // Parse the coordinates
    const coordsPattern = /^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/;
    const match = this.coordinatesQuery.match(coordsPattern);
    
    if (!match) {
      this.toastService.error('Invalid coordinates format. Use "lat, lng" (e.g. 51.5, -0.09)');
      return;
    }
    
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.toastService.error('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180');
      return;
    }
    
    // Clear existing marker
    this.clearMarkers();
    
    // Add a new marker
    const map = this.mapService.getMap();
    const marker = L.marker([lat, lng], {
      icon: this.mapService.getSearchIcon()
    }).addTo(map);
    
    // Try to get the location name
    this.apiService.reverseGeocode(lat, lng).subscribe({
      next: (result) => {
        if (result && result.display_name) {
          marker.bindPopup(result.display_name).openPopup();
        } else {
          marker.bindPopup(`Latitude: ${lat}, Longitude: ${lng}`).openPopup();
        }
      },
      error: (error) => {
        console.error('Error reverse geocoding:', error);
        marker.bindPopup(`Latitude: ${lat}, Longitude: ${lng}`).openPopup();
      }
    });
    
    // Pan to the location
    this.mapService.panTo(lat, lng, 14);
  }

  /**
   * Find the user's current location
   */
  findMyLocation(): void {
    if (!navigator.geolocation) {
      this.toastService.error('Geolocation is not supported by your browser');
      return;
    }
    
    this.toastService.info('Finding your location...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Clear existing marker
        this.clearMarkers();
        
        // Add a new marker
        const map = this.mapService.getMap();
        const marker = L.marker([lat, lng], {
          icon: this.mapService.getSearchIcon()
        }).addTo(map);
        
        // Try to get the location name
        this.apiService.reverseGeocode(lat, lng).subscribe({
          next: (result) => {
            if (result && result.display_name) {
              marker.bindPopup(`Your location: ${result.display_name}`).openPopup();
            } else {
              marker.bindPopup(`Your location: ${lat}, ${lng}`).openPopup();
            }
          },
          error: (error) => {
            console.error('Error reverse geocoding:', error);
            marker.bindPopup(`Your location: ${lat}, ${lng}`).openPopup();
          }
        });
        
        // Pan to the location
        this.mapService.panTo(lat, lng, 14);
        
        this.toastService.success('Found your location');
      },
      (error) => {
        console.error('Error getting location:', error);
        let errorMessage = 'Error finding your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location services in your browser.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        this.toastService.error(errorMessage);
      }
    );
  }

  /**
   * Clear the search markers from the map
   */
  private clearMarkers(): void {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
  }
} 
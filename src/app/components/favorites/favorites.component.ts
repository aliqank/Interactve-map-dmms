import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FavoritePolygon } from '../../services/storage.service';
import { ModalComponent } from '../shared/modal/modal.component';
import { ToastService } from '../../services/toast.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css']
})
export class FavoritesComponent implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Input() favoritePolygons: FavoritePolygon[] = [];
  @Input() currentPolygonId: string | null = null;
  
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() loadFavorite = new EventEmitter<FavoritePolygon>();
  @Output() deleteFavorite = new EventEmitter<FavoritePolygon>();
  
  // Local copies of data
  localFavoritePolygons: FavoritePolygon[] = [];
  localCurrentPolygonId: string | null = null;
  
  constructor(
    private toastService: ToastService,
    private storageService: StorageService
  ) {}
  
  ngOnInit(): void {
    console.log('FavoritesComponent initialized');
    this.loadDataFromStorage();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && changes['isVisible'].currentValue === true) {
      console.log('Visibility changed to visible, reloading data from storage');
      this.loadDataFromStorage();
    }
  }
  
  /**
   * Load data from storage
   */
  private loadDataFromStorage(): void {
    // Load favorite polygons from storage
    this.localFavoritePolygons = this.storageService.loadFavoritePolygons();
    console.log('Loaded favorite polygons from storage:', this.localFavoritePolygons);
    
    // Load current polygon ID from storage
    this.localCurrentPolygonId = this.storageService.loadCurrentPolygonId();
    console.log('Loaded current polygon ID from storage:', this.localCurrentPolygonId);
  }
  
  /**
   * Toggle the visibility of the favorites component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.loadDataFromStorage();
    }
    
    this.visibilityChange.emit(this.isVisible);
  }
  
  /**
   * Load a favorite polygon
   * @param favorite The favorite polygon to load
   */
  loadFavoritePolygon(favorite: FavoritePolygon): void {
    console.log('Loading favorite:', favorite);
    
    // Update local state
    this.localCurrentPolygonId = favorite.id;
    
    // Save to storage
    this.storageService.saveCurrentPolygonId(favorite.id);
    
    // Save the coordinates to storage so the polygon-draw component can access them
    this.storageService.savePolygonCoordinates(favorite.coordinates);
    
    // Emit event to parent component
    this.loadFavorite.emit(favorite);
    
    // Show success message
    this.toastService.success(`Loaded polygon: ${favorite.name}`);
    
    // Close the modal after loading
    this.isVisible = false;
    this.visibilityChange.emit(false);
  }
  
  /**
   * Delete a favorite polygon
   * @param favorite The favorite polygon to delete
   * @param event The mouse event
   */
  deleteFavoritePolygon(favorite: FavoritePolygon, event: MouseEvent): void {
    // Stop event propagation to prevent loading the polygon when clicking delete
    event.stopPropagation();
    
    if (confirm(`Are you sure you want to delete "${favorite.name}"?`)) {
      console.log('Deleting favorite:', favorite);
      this.deleteFavorite.emit(favorite);
      
      // Update local data
      this.localFavoritePolygons = this.localFavoritePolygons.filter(p => p.id !== favorite.id);
      
      // If the deleted polygon was the current one, clear the current polygon ID
      if (this.localCurrentPolygonId === favorite.id) {
        this.localCurrentPolygonId = null;
      }
    }
  }
} 
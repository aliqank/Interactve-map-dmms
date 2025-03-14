import { Component, EventEmitter, Input, Output } from '@angular/core';
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
export class FavoritesComponent {
  @Input() isVisible = false;
  @Input() favoritePolygons: FavoritePolygon[] = [];
  @Input() currentPolygonId: string | null = null;
  
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() loadFavorite = new EventEmitter<FavoritePolygon>();
  @Output() deleteFavorite = new EventEmitter<FavoritePolygon>();
  
  constructor(
    private toastService: ToastService,
    private storageService: StorageService
  ) {}
  
  /**
   * Toggle the visibility of the favorites component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChange.emit(this.isVisible);
  }
  
  /**
   * Load a favorite polygon
   * @param favorite The favorite polygon to load
   */
  loadFavoritePolygon(favorite: FavoritePolygon): void {
    this.loadFavorite.emit(favorite);
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
      this.deleteFavorite.emit(favorite);
    }
  }
} 
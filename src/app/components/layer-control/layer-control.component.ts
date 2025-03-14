import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MapService } from '../../services/map.service';
import { ModalComponent } from '../shared/modal/modal.component';

@Component({
  selector: 'app-layer-control',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './layer-control.component.html',
  styleUrls: ['./layer-control.component.css']
})
export class LayerControlComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Output() visibilityChange = new EventEmitter<boolean>();
  
  selectedLayer = 'roadmap';
  availableLayers = ['roadmap', 'satellite', 'hybrid', 'terrain', 'osm'];
  private subscription: Subscription | null = null;

  constructor(private mapService: MapService) { }

  ngOnInit(): void {
    // Subscribe to layer changes
    this.subscription = this.mapService.getSelectedLayerObservable().subscribe(layer => {
      this.selectedLayer = layer;
    });
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // React to changes in the isVisible input
    if (changes['isVisible'] && !changes['isVisible'].firstChange) {
      // Handle visibility changes if needed
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  
  /**
   * Toggle visibility of the component
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChange.emit(this.isVisible);
  }

  /**
   * Change the map layer
   * @param layer The layer to change to
   */
  changeLayer(layer: string): void {
    this.mapService.changeMapLayer(layer);
  }

  /**
   * Get the icon for a layer
   * @param layer The layer to get the icon for
   * @returns The icon class
   */
  getLayerIcon(layer: string): string {
    switch (layer) {
      case 'roadmap':
        return 'fa-road';
      case 'satellite':
        return 'fa-satellite';
      case 'hybrid':
        return 'fa-globe';
      case 'terrain':
        return 'fa-mountain';
      case 'osm':
        return 'fa-map';
      default:
        return 'fa-map';
    }
  }
} 
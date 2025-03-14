import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-layer-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layer-control.component.html',
  styleUrls: ['./layer-control.component.css']
})
export class LayerControlComponent implements OnInit, OnDestroy {
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

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Change the map layer
   * @param layerType The layer type to change to
   */
  changeLayer(layerType: string): void {
    this.mapService.changeMapLayer(layerType);
  }

  /**
   * Get the icon class for a layer
   * @param layer The layer type
   * @returns The icon class
   */
  getLayerIcon(layer: string): string {
    switch (layer) {
      case 'roadmap':
        return 'fa-road';
      case 'satellite':
        return 'fa-satellite';
      case 'hybrid':
        return 'fa-layer-group';
      case 'terrain':
        return 'fa-mountain';
      case 'osm':
        return 'fa-map';
      default:
        return 'fa-map';
    }
  }
} 
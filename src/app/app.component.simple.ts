import { AfterViewInit, Component } from '@angular/core';
import * as L from 'leaflet';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-root',
  template: `
    <div id="map" style="height: 100vh; width: 100vw;"></div>
  `,
  styles: [`
    #map {
      height: 100vh;
      width: 100vw;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      background-color: #f0f0f0;
    }
  `],
  standalone: true,
  imports: [
    FormsModule, 
    CommonModule, 
    HttpClientModule
  ]
})
export class AppComponent implements AfterViewInit {
  private map!: L.Map;

  constructor() {}

  ngAfterViewInit(): void {
    console.log('ngAfterViewInit called');
    
    // Initialize map with a delay
    setTimeout(() => {
      this.initializeMap();
    }, 500);
  }

  private initializeMap(): void {
    try {
      console.log('Initializing map...');
      
      // Create a simple map
      this.map = L.map('map').setView([51.505, -0.09], 13);
      
      console.log('Map created:', this.map);
      
      // Add a simple OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);
      
      console.log('Tile layer added');
      
      // Add a marker
      L.marker([51.5, -0.09]).addTo(this.map)
        .bindPopup('A simple marker.')
        .openPopup();
      
      console.log('Marker added');
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }
} 
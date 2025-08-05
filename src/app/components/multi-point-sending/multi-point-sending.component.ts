import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { timeout, TimeoutError, interval, Subscription } from 'rxjs';
import * as L from 'leaflet';
import { ApiSettings } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

interface Point {
  lat: number;
  lng: number;
  marker: L.Marker;
  popup: L.Popup;
  sent: boolean;
  error: boolean;
}

@Component({
  selector: 'app-multi-point-sending',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-point-sending.component.html',
  styleUrls: ['./multi-point-sending.component.css']
})
export class MultiPointSendingComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Input() map!: L.Map;
  @Input() apiSettings!: ApiSettings;
  @Input() apiError = false;
  
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Output() apiErrorChange = new EventEmitter<boolean>();
  
  private mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private points: Point[] = [];
  private polyline: L.Polyline | null = null;
  private sendingSubscription: Subscription | null = null;
  public isSending = false;
  public currentPointIndex = 0;
  
  constructor(
    private http: HttpClient,
    private toastService: ToastService
  ) {}
  
  ngOnInit(): void {
    if (this.isVisible) {
      this.activateMultiPointMode();
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && !changes['isVisible'].firstChange) {
      const currentValue = changes['isVisible'].currentValue;
      const previousValue = changes['isVisible'].previousValue;
      
      if (currentValue !== previousValue) {
        if (currentValue) {
          this.activateMultiPointMode();
        } else {
          this.deactivateMultiPointMode();
        }
      }
    }
  }
  
  ngOnDestroy(): void {
    this.deactivateMultiPointMode();
  }
  
  /**
   * Активирует режим выбора нескольких точек
   */
  private activateMultiPointMode(): void {
    this.mapClickHandler = (e: L.LeafletMouseEvent) => this.handleMapClick(e);
    
    if (this.map && this.mapClickHandler) {
      this.map.on('click', this.mapClickHandler);
    }
    
    this.toastService.info('Режим выбора точек активирован. Кликайте по карте для добавления точек.');
    this.apiError = false;
    this.apiErrorChange.emit(this.apiError);
  }
  
  /**
   * Деактивирует режим выбора нескольких точек
   */
  private deactivateMultiPointMode(): void {
    if (this.map && this.mapClickHandler) {
      this.map.off('click', this.mapClickHandler);
      this.mapClickHandler = null;
    }
    
    this.clearAllPoints();
    this.stopSending();
  }
  
  /**
   * Обрабатывает клик по карте
   * @param e Событие клика Leaflet
   */
  handleMapClick(e: L.LeafletMouseEvent): void {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    this.addPoint(lat, lng);
  }
  
  /**
   * Добавляет точку на карту
   * @param lat Широта
   * @param lng Долгота
   */
  private addPoint(lat: number, lng: number): void {
    // Создаем маркер
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: #4263eb; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    }).addTo(this.map);
    
    // Создаем попап
    const popup = L.popup({
      className: 'point-popup',
      closeButton: false,
      autoClose: false,
      closeOnEscapeKey: false,
      closeOnClick: false,
      maxWidth: 200,
      minWidth: 150,
      offset: [0, -10]
    })
      .setLatLng([lat, lng])
      .setContent(`
        <div style="font-size: 12px; line-height: 1.3; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
            <i class="fas fa-map-marker-alt" style="color: #4263eb; font-size: 11px;"></i>
            <span style="font-weight: bold;">Точка ${this.points.length + 1}</span>
          </div>
          <div style="font-size: 10px; color: #666;">
            ${lat.toFixed(6)}, ${lng.toFixed(6)}
          </div>
          <div style="font-size: 9px; color: #999; margin-top: 2px;">
            Ожидает отправки
          </div>
        </div>
      `)
      .openOn(this.map);
    
    // Добавляем точку в массив
    const point: Point = {
      lat,
      lng,
      marker,
      popup,
      sent: false,
      error: false
    };
    
    this.points.push(point);
    
    // Обновляем линию
    this.updatePolyline();
    
    this.toastService.info(`Добавлена точка ${this.points.length}. Всего точек: ${this.points.length}`);
  }
  
  /**
   * Обновляет полилинию, соединяющую точки
   */
  private updatePolyline(): void {
    // Удаляем старую линию
    if (this.polyline) {
      this.map.removeLayer(this.polyline);
    }
    
    // Создаем новую линию, если есть больше одной точки
    if (this.points.length > 1) {
      const coordinates = this.points.map(point => [point.lat, point.lng] as [number, number]);
      this.polyline = L.polyline(coordinates, {
        color: '#4263eb',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 5'
      }).addTo(this.map);
    }
  }
  
  /**
   * Очищает все точки с карты
   */
  private clearAllPoints(): void {
    // Удаляем все маркеры
    this.points.forEach(point => {
      if (point.marker) {
        this.map.removeLayer(point.marker);
      }
      if (point.popup && point.popup.isOpen()) {
        point.popup.close();
      }
    });
    
    // Удаляем линию
    if (this.polyline) {
      this.map.removeLayer(this.polyline);
      this.polyline = null;
    }
    
    this.points = [];
    this.currentPointIndex = 0;
  }
  
  /**
   * Начинает отправку точек с интервалом 1 секунда
   */
  startSending(): void {
    if (this.points.length === 0) {
      this.toastService.warning('Нет точек для отправки');
      return;
    }
    
    if (this.isSending) {
      this.toastService.warning('Отправка уже выполняется');
      return;
    }
    
    this.isSending = true;
    this.currentPointIndex = 0;
    
    this.toastService.info(`Начинается отправка ${this.points.length} точек с интервалом 1 секунда`);
    
    // Отправляем первую точку сразу
    this.sendCurrentPoint();
    
    // Настраиваем интервал для остальных точек
    this.sendingSubscription = interval(1000).subscribe(() => {
      this.currentPointIndex++;
      
      if (this.currentPointIndex < this.points.length) {
        this.sendCurrentPoint();
      } else {
        this.stopSending();
        this.toastService.success('Все точки отправлены');
      }
    });
  }
  
  /**
   * Отправляет текущую точку
   */
  private sendCurrentPoint(): void {
    if (this.currentPointIndex >= this.points.length) {
      return;
    }
    
    const point = this.points[this.currentPointIndex];
    
    // Обновляем попап - показываем отправку
    point.popup.setContent(`
      <div style="font-size: 12px; line-height: 1.3; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
          <i class="fas fa-map-marker-alt" style="color: #4263eb; font-size: 11px;"></i>
          <span style="font-weight: bold;">Точка ${this.currentPointIndex + 1}</span>
        </div>
        <div style="font-size: 10px; color: #666;">
          ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
        </div>
        <div style="font-size: 9px; color: #4263eb; margin-top: 2px;">
          <i class="fas fa-spinner fa-spin"></i> Отправка...
        </div>
      </div>
    `);
    
    // Отправляем координаты
    this.sendCoordinatesToAPI(point.lat, point.lng, this.currentPointIndex);
  }
  
  /**
   * Отправляет координаты в API
   * @param latitude Широта
   * @param longitude Долгота
   * @param pointIndex Индекс точки
   */
  private sendCoordinatesToAPI(latitude: number, longitude: number, pointIndex: number): void {
    const apiUrl = this.apiSettings.apiUrl;
    
    const payload = {
      bearerId: null,
      trackerId: this.apiSettings.trackerId,
      latitude: latitude,
      longitude: longitude
    };

    const headers = { 
      'Content-Type': 'application/json',
      'accept': 'text/plain'
    };

    this.http.post(apiUrl, payload, { headers })
      .pipe(
        timeout(5000)
      )
      .subscribe({
        next: (response: any) => {
          const point = this.points[pointIndex];
          if (point) {
            point.sent = true;
            point.error = false;
            
            // Обновляем попап - успех
            point.popup.setContent(`
              <div style="font-size: 12px; line-height: 1.3; padding: 4px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                  <i class="fas fa-map-marker-alt" style="color: #4263eb; font-size: 11px;"></i>
                  <span style="font-weight: bold;">Точка ${pointIndex + 1}</span>
                </div>
                <div style="font-size: 10px; color: #666;">
                  ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
                </div>
                <div style="font-size: 9px; color: #2b8a3e; margin-top: 2px;">
                  <i class="fas fa-check-circle"></i> Отправлено
                </div>
              </div>
            `);
            
            // Обновляем маркер
            point.marker.setIcon(L.divIcon({
              className: 'custom-marker-success',
              html: `<div style="background-color: #2b8a3e; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            }));
          }
          
          this.apiError = false;
          this.apiErrorChange.emit(this.apiError);
        },
        error: (error) => {
          const point = this.points[pointIndex];
          if (point) {
            point.sent = false;
            point.error = true;
            
            const errorMessage = error instanceof TimeoutError 
              ? 'Таймаут' 
              : 'Ошибка сети';
            
            // Обновляем попап - ошибка
            point.popup.setContent(`
              <div style="font-size: 12px; line-height: 1.3; padding: 4px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                  <i class="fas fa-map-marker-alt" style="color: #4263eb; font-size: 11px;"></i>
                  <span style="font-weight: bold;">Точка ${pointIndex + 1}</span>
                </div>
                <div style="font-size: 10px; color: #666;">
                  ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
                </div>
                <div style="font-size: 9px; color: #e03131; margin-top: 2px;">
                  <i class="fas fa-exclamation-circle"></i> ${errorMessage}
                </div>
              </div>
            `);
            
            // Обновляем маркер
            point.marker.setIcon(L.divIcon({
              className: 'custom-marker-error',
              html: `<div style="background-color: #e03131; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            }));
          }
          
          this.apiError = true;
          this.apiErrorChange.emit(this.apiError);
        }
      });
  }
  
  /**
   * Останавливает отправку точек
   */
  stopSending(): void {
    if (this.sendingSubscription) {
      this.sendingSubscription.unsubscribe();
      this.sendingSubscription = null;
    }
    
    this.isSending = false;
    this.currentPointIndex = 0;
  }
  
  /**
   * Очищает все точки
   */
  clearPoints(): void {
    this.stopSending();
    this.clearAllPoints();
    this.toastService.info('Все точки очищены');
  }
  
  /**
   * Закрывает панель
   */
  closePanel(): void {
    this.isVisible = false;
    this.visibilityChange.emit(this.isVisible);
    this.deactivateMultiPointMode();
  }
  
  /**
   * Переключает видимость компонента
   */
  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChange.emit(this.isVisible);
    
    if (this.isVisible) {
      this.activateMultiPointMode();
    } else {
      this.deactivateMultiPointMode();
    }
  }
  
  /**
   * Получает количество точек
   */
  get pointsCount(): number {
    return this.points.length;
  }
  
  /**
   * Получает количество отправленных точек
   */
  get sentPointsCount(): number {
    return this.points.filter(p => p.sent).length;
  }
  
  /**
   * Получает количество точек с ошибками
   */
  get errorPointsCount(): number {
    return this.points.filter(p => p.error).length;
  }
} 
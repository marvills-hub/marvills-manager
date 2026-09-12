import { Injectable } from '@angular/core';
import { DiagramGridSettings, DiagramPoint } from '../../../../../core/models/diagram.model';
import { DIAGRAM_GRID_DEFAULTS } from '../constants/diagram-grid.constant';
@Injectable({
  providedIn: 'root',
})
export class DiagramGridService {
  readonly defaults = DIAGRAM_GRID_DEFAULTS;
  snapValue(value: number, settings: DiagramGridSettings): number {
    if (!settings.snap || settings.size <= 0) return value;
    return Math.round(value / settings.size) * settings.size;
  }
  snapPoint(point: DiagramPoint, settings: DiagramGridSettings): DiagramPoint {
    if (!settings.snap) return { ...point };
    return {
      x: this.snapValue(point.x, settings),
      y: this.snapValue(point.y, settings),
    };
  }
  snapSize(
    width: number,
    height: number,
    settings: DiagramGridSettings,
  ): { width: number; height: number } {
    if (!settings.snap) return { width, height };
    return {
      width: Math.max(settings.size, this.snapValue(width, settings)),
      height: Math.max(settings.size, this.snapValue(height, settings)),
    };
  }
  getBackgroundSize(settings: DiagramGridSettings): string {
    return `${settings.size}px ${settings.size}px`;
  }
  normalize(settings?: Partial<DiagramGridSettings> | null): DiagramGridSettings {
    return {
      enabled: settings?.enabled ?? DIAGRAM_GRID_DEFAULTS.enabled,
      snap: settings?.snap ?? DIAGRAM_GRID_DEFAULTS.snap,
      size: Math.max(1, settings?.size ?? DIAGRAM_GRID_DEFAULTS.size),
    };
  }
}

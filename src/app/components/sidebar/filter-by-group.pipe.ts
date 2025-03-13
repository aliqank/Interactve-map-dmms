import { Pipe, PipeTransform } from '@angular/core';
import { ControlItem, ControlGroup } from './sidebar.component';

@Pipe({
  name: 'filterByGroup',
  standalone: true
})
export class FilterByGroupPipe implements PipeTransform {
  transform(items: ControlItem[], group: ControlGroup): ControlItem[] {
    return items.filter(item => item.group === group);
  }
} 
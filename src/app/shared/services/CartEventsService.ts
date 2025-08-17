import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CartEventsService {
  private readonly cartResetSource = new Subject<void>();
  
  // Observable for cart reset events
  cartReset$ = this.cartResetSource.asObservable();

  // Call this when cart needs to be reset
  resetCart(): void {
    this.cartResetSource.next();
  }
}

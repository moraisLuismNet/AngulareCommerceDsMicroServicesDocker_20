import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  catchError,
  Observable,
  of,
  tap,
  map,
  throwError,
  switchMap,
} from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthGuard } from '../../guards/AuthGuardService';
import { ICartDetail, IRecord } from '../EcommerceInterface';
import { UserService } from 'src/app/services/UserService';
import { StockService } from './StockService';
import { RecordsService } from './RecordsService';

@Injectable({
  providedIn: 'root',
})
export class CartDetailService {
  urlAPI = environment.apiUrl.shoppingService;
  private cart: IRecord[] = [];
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);
  private readonly userService = inject(UserService);
  private readonly stockService = inject(StockService);
  private readonly recordsService = inject(RecordsService);

  getCartItemCount(email: string): Observable<any> {
    // Verify that the email matches the current user
    if (this.userService.email !== email) {
      return of({ totalItems: 0 });
    }
    const headers = this.getHeaders();
    return this.http
      .get(`${this.urlAPI}CartDetails/GetCartItemCount/${encodeURIComponent(email)}`, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error getting cart item count:', error);
          return of({ totalItems: 0 });
        })
      );
  }

  getCartDetails(email: string): Observable<{ $values: any[] }> {
    // Check if the user is authenticated before making the request
    if (!this.authGuard.isLoggedIn()) {
      console.warn('[CartDetailService] User is not authenticated');
      return of({ $values: [] });
    }

    // Get the current user's email to verify ownership
    const currentUser = this.authGuard.getUser();
    if (email !== currentUser) {
      console.warn(`[CartDetailService] Access denied: User ${currentUser} cannot access cart for ${email}`);
      return of({ $values: [] });
    }

    // Get the cart ID from the token or session storage
    const cartId = this.authGuard.getCartId();
    
    // If we don't have a cart ID, try to get cart by email
    if (!cartId) {
      return this.getCartDetailsByEmail(email).pipe(
        map(cartDetails => ({
          $values: Array.isArray(cartDetails) ? cartDetails : [cartDetails]
        })),
        catchError(error => {
          console.error('[CartDetailService] Error getting cart details by email:', error);
          return of({ $values: [] });
        })
      );
    }
    
    const headers = this.getHeaders();
    const url = `${this.urlAPI}CartDetails/GetCartDetailsByCartId/${cartId}`;
    
    return this.http.get<{ $values: any[] } | any[]>(url, { 
      headers,
      observe: 'response'
    }).pipe(
      map(response => {
        const body = response.body;
        // Handle different possible response formats
        if (Array.isArray(body)) {
          return { $values: body };
        } else if (body && Array.isArray((body as any).$values)) {
          return body as { $values: any[] };
        } else if (body && typeof body === 'object') {
          // If the response is an object but doesn't have $values, return it as is
          return { $values: [body] };
        } else {
          return { $values: [] };
        }
      }),
      catchError((error) => {
        console.error('[CartDetailService] Error getting cart details:', {
          status: error.status,
          statusText: error.statusText,
          error: error.error,
          url: error.url,
          headers: error.headers
        });
        
        if (error.status === 403) {
          console.warn('[CartDetailService] Access denied - User does not have permission to access this cart');
        }
        
        // Fall back to email-based endpoint if cart ID approach fails
        if (error.status === 404) {
          return this.http.get<{ $values: any[] }>(
            `${this.urlAPI}CartDetails/GetCartDetails/${encodeURIComponent(email)}`,
            { headers }
          ).pipe(
            catchError(fallbackError => {
              console.error('[CartDetailService] Fallback endpoint also failed:', fallbackError);
              return of({ $values: [] });
            })
          );
        }
        
        return of({ $values: [] });
      })
    );
  }

  // Debug method to check cart details
  debugGetCartDetails(email: string): void {
    const url = `${this.urlAPI}CartDetails/GetCartDetails/${encodeURIComponent(email)}`;
    console.log(`[CartDetailService][DEBUG] Fetching cart details from: ${url}`);
    
    this.http.get(url, { headers: this.getHeaders() })
      .subscribe({
        next: (response) => {
          if (response && typeof response === 'object') {
            console.log('[CartDetailService][DEBUG] Response keys:', Object.keys(response));
          }
        },
        error: (error) => {
          console.error('[CartDetailService][DEBUG] Error fetching cart details:', {
            status: error.status,
            error: error.error,
            url: error.url
          });
        }
      });
  }

  getRecordDetails(recordId: number): Observable<IRecord | null> {
    return this.recordsService.getRecordById(recordId).pipe(
      catchError((error) => {
        console.error('Error getting record details:', error);
        return of(null);
      })
    );
  }

  addToCartDetail(
    email: string,
    recordId: number,
    amount: number
  ): Observable<any> {
    const headers = this.getHeaders();
    
    return this.http
      .post(
        `${this.urlAPI}CartDetails/addToCartDetailAndCart/${encodeURIComponent(email)}?recordId=${recordId}&amount=${amount}`,
        {},
        { 
          headers,
          observe: 'response' 
        }
      )
      .pipe(
        switchMap((response: any) => {
          // Get the updated stock from the registry
          return this.getRecordDetails(recordId).pipe(
            map(record => {
              if (!record) {
                throw new Error('The updated record could not be obtained.');
              }
              return {
                success: true,
                recordId: recordId,
                amount: amount,
                stock: record.stock // Include updated stock
              };
            })
          );
        }),
        catchError((error) => {
          console.error('[CartDetailService] Error en addToCartDetail:', {
            status: error.status,
            statusText: error.statusText,
            error: error.error,
            url: error.url
          });
          return throwError(() => error);
        })
      );
  }

  removeFromCartDetail(
    email: string,
    recordId: number,
    amount: number
  ): Observable<any> {
    if (!email || !recordId) {
      return throwError(() => new Error('Invalid parameters'));
    }

    const headers = this.getHeaders();
    return this.http
      .post(
        `${this.urlAPI}CartDetails/removeFromCartDetailAndCart/${encodeURIComponent(email)}?recordId=${recordId}&amount=${amount}`,
        {},
        { 
          headers,
          observe: 'response'
        }
      )
      .pipe(
        switchMap((response: any) => {
          // Get the updated stock from the registry
          return this.getRecordDetails(recordId).pipe(
            map(record => {
              if (!record) {
                throw new Error('The updated record could not be obtained.');
              }
              return {
                success: true,
                recordId: recordId,
                amount: -amount,
                stock: record.stock // Include updated stock
              };
            })
          );
        }),
        catchError((error) => {
          console.error('[CartDetailService] Error removing from cart:', {
            status: error.status,
            statusText: error.statusText,
            error: error.error,
            url: error.url
          });
          return throwError(() => error);
        })
      );
  }

  addAmountCartDetail(detail: ICartDetail): Observable<ICartDetail> {
    return this.http.put<ICartDetail>(
      `${this.urlAPI}cartDetails/${detail.idCartDetail}`,
      detail
    );
  }

  updateRecordStock(recordId: number, change: number): Observable<IRecord> {
    if (typeof change !== 'number' || isNaN(change)) {
      return throwError(() => new Error('Invalid stock change value'));
    }

    return this.http
      .put<any>(
        `${this.urlAPI}records/${recordId}/updateStock/${change}`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        tap((response) => {
          const newStock = response?.newStock;
          if (typeof newStock === 'number' && newStock >= 0) {
            this.stockService.notifyStockUpdate(recordId, newStock);
          } else {
            throw new Error('Received invalid stock value from server');
          }
        }),
        map(
          (response) =>
            ({
              idRecord: recordId,
              stock: response.newStock,
              titleRecord: '',
              yearOfPublication: null,
              imageRecord: null,
              photo: null,
              price: 0,
              discontinued: false,
              groupId: null,
              groupName: '',
              nameGroup: '',
            } as IRecord)
        ),
        catchError((error) => {
          return throwError(
            () => new Error('Failed to update stock. Please try again.')
          );
        })
      );
  }

  getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return headers;
  }

  incrementQuantity(detail: ICartDetail): Observable<ICartDetail> {
    const previousAmount = detail.amount;
    detail.amount++;
    return new Observable((observer) => {
      this.addAmountCartDetail(detail).subscribe({
        next: () => {
          this.updateRecordStock(detail.recordId, -1).subscribe({
            next: () => {
              observer.next(detail);
              observer.complete();
            },
            error: (err) => {
              detail.amount = previousAmount;
              observer.error(err);
            },
          });
        },
        error: (err) => {
          detail.amount = previousAmount;
          observer.error(err);
        },
      });
    });
  }

  decrementQuantity(detail: ICartDetail): Observable<ICartDetail> {
    if (detail.amount <= 1) {
      // Do not allow quantities less than 1
      return of(detail); // Return the detail without changes
    }
    const previousAmount = detail.amount;
    detail.amount--;
    return new Observable((observer) => {
      this.addAmountCartDetail(detail).subscribe({
        next: () => {
          this.updateRecordStock(detail.recordId, 1).subscribe({
            next: () => {
              observer.next(detail);
              observer.complete();
            },
            error: (err) => {
              detail.amount = previousAmount;
              observer.error(err);
            },
          });
        },
        error: (err) => {
          detail.amount = previousAmount;
          observer.error(err);
        },
      });
    });
  }

  getCartDetailsByEmail(email: string): Observable<ICartDetail[]> {
    const url = `${this.urlAPI}CartDetails/GetCartDetails/${encodeURIComponent(email)}`;
    const token = this.authGuard.getToken();
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get<any>(url, { 
      headers,
      observe: 'response' // To see the full response headers
    }).pipe(
      tap(response => {
      }),
      map(response => {
        // Handle different response formats
        let data = response.body;
        
        if (Array.isArray(data)) {
          return data as ICartDetail[];
        } else if (data && Array.isArray(data.$values)) {
          return data.$values as ICartDetail[];
        } else if (data && typeof data === 'object') {
          return [data] as ICartDetail[];
        }
        
        return [];
      }),
      catchError((error: any) => {
        console.error('[CartDetailService] Error in the request:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url || url,
          error: error.error,
          headers: error.headers ? Object.fromEntries(
            Object.entries(error.headers)
              .filter(([key]) => !key.toLowerCase().includes('authorization'))
          ) : 'No headers'
        });
        
        // If it is a 403 error, try the debug method
        if (error.status === 403) {
          console.warn('[CartDetailService] Access attempt denied (403). Testing with debugging method...');
          return this.debugFetchCartDetails(email);
        }
        
        return throwError(() => error);
      })
    );
  }
  
  // Alternative method using fetch for diagnosis
  private async debugFetchCartDetails(email: string): Promise<ICartDetail[]> {
    const url = `${this.urlAPI}CartDetails/GetCartDetails/${encodeURIComponent(email)}`;
    const token = this.authGuard.getToken();
    
    console.log('[CartDetailService][DEBUG] Testing with direct fetch to:', url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      // Create a simple object with headers
      const responseHeaders: { [key: string]: string } = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      console.log('[CartDetailService][DEBUG] Fetch response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: responseHeaders
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CartDetailService][DEBUG] Error in the response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[CartDetailService][DEBUG] Response data:', data);
      
      if (Array.isArray(data)) {
        return data as ICartDetail[];
      } else if (data && Array.isArray(data.$values)) {
        return data.$values as ICartDetail[];
      } else if (data && typeof data === 'object') {
        return [data] as ICartDetail[];
      }
      
      return [];
    } catch (error) {
      console.error('[CartDetailService][DEBUG] Error in direct fetch:', error);
      return [];
    }
  }
}

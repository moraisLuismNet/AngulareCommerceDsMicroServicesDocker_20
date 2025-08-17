import { Injectable, inject } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthGuard } from '../guards/AuthGuardService';
import { jwtDecode } from 'jwt-decode';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly authGuard = inject(AuthGuard);
  private readonly router = inject(Router);


  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Get the token from the storage
    const token = this.authGuard.getToken();
    
    // Skip token validation for login/register endpoints
    if (request.url.includes('/auth/')) {
      return next.handle(request);
    }

    // Validate token if it exists
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        
        if (decodedToken.exp < currentTime) {
          console.error('[AuthInterceptor] Token has expired');
          this.router.navigate(['/login']);
          return throwError(() => new Error('Token has expired'));
        }

        // Clone the request and add the authorization header
        // Do not set Content-Type to allow the browser to set it automatically
        // with the correct boundary for FormData
        const headers: { [key: string]: string } = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        };

        // Only add Content-Type if it is not a request with FormData
        if (!(request.body instanceof FormData)) {
          headers['Content-Type'] = 'application/json';
        }

        const authReq = request.clone({
          setHeaders: headers,
          withCredentials: false // Important to avoid problems with CORS
        });

        return next.handle(authReq).pipe(
          catchError((error: HttpErrorResponse) => {
            console.error(`[AuthInterceptor] Error ${error.status} for ${request.url}`, {
              status: error.status,
              statusText: error.statusText,
              error: error.error
            });

            if (error.status === 401) {
              console.log('[AuthInterceptor] Unauthorized - redirecting to login');
              this.router.navigate(['/login']);
            } else if (error.status === 403) {
              console.error('[AuthInterceptor] Access denied (403)', {
                url: request.url,
                method: request.method,
                error: error.error
              });
            }

            return throwError(() => error);
          })
        );

      } catch (error) {
        console.error('[AuthInterceptor] Error processing token:', error);
        this.router.navigate(['/login']);
        return throwError(() => error);
      }
    }

    // If no token and not an auth endpoint, continue without token
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error(`[AuthInterceptor] Error without token for ${request.url}:`, error);
        return throwError(() => error);
      })
    );
  }
}

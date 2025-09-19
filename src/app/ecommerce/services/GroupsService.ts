import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { IGroup } from '../EcommerceInterface';

@Injectable({
  providedIn: 'root',
})
export class GroupsService {
  private readonly baseUrl = environment.apiUrl.cdService;
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);

  private getHeaders(contentType: string = 'application/json'): HttpHeaders {
    const token = this.authGuard.getToken();
    const headers: { [key: string]: string } = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };

    // Only add Content-Type if it is not multipart/form-data
    // as the browser automatically sets it to the correct limit
    if (contentType && contentType !== 'multipart/form-data') {
      headers['Content-Type'] = contentType;
    }

    return new HttpHeaders(headers);
  }

  getGroups(): Observable<IGroup[]> {
    const headers = this.getHeaders();

    return this.http
      .get<any>(`${this.baseUrl}groups`, { headers })
      .pipe(
        map((response) => {
          // Handle different response formats
          let groups: any[] = [];

          if (Array.isArray(response)) {
            // If the response is already an array
            groups = response;
          } else if (response && typeof response === 'object') {
            // If the response is an object with a $values property (common in .NET Core)
            if (response.hasOwnProperty('$values')) {
              groups = response.$values || [];
            } else if (response.hasOwnProperty('data')) {
              // If the response has a data property (common in some APIs)
              groups = response.data || [];
            } else {
              // If it's an object but not in the expected format, try to convert it to an array
              groups = Object.values(response);
            }
          }

          return groups as IGroup[];
        }),
        catchError((error: any) => {
          console.error('Error in getGroups:', error);
          return of([]); // Return empty array on error to prevent breaking the subscription
        })
      );
  }

  addGroup(group: IGroup): Observable<IGroup> {
    // Configure URL parameters exactly as in cURL
    let params = new HttpParams()
      .set('NameGroup', group.nameGroup);

    if (group.musicGenreId) {
      params = params.set('MusicGenreId', group.musicGenreId.toString());
    }

    // Create FormData for the image
    const formData = new FormData();
    
    if (group.photo) {
      // Create a new Blob from the file
      const blob = new Blob([group.photo], { type: group.photo.type || 'application/octet-stream' });
      
      // Add the file to FormData with the exact name 'Photo'
      formData.append('Photo', blob, group.photo.name);
    }
    
    // Configure the minimum necessary headers
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authGuard.getToken()}`,
      'Accept': 'text/plain'
      // Do not set Content-Type here, Angular will do it automatically with the correct boundary
    });
    
    // Application Options
    const httpOptions = {
      headers: headers,
      params: params,
      reportProgress: true,
      withCredentials: false // Disable withCredentials to avoid CORS issues
    };
    
    // Make the request
    return this.http.post<IGroup>(
      `${this.baseUrl}Groups`,
      formData,
      httpOptions
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Error creating group';
        
        // Extract error message from server if available
        if (error.error?.errors) {
          // Handling ModelState validation errors
          const validationErrors = Object.entries(error.error.errors)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`)
            .join('; ');
          errorMessage = `Validation error: ${validationErrors}`;
        } else if (error.error) {
          // Handling other types of server errors
          const serverError = error.error;
          if (typeof serverError === 'object') {
            errorMessage = serverError.title || serverError.message || 
                         (serverError.error ? String(serverError.error) : 'Unknown server error');
          } else if (typeof serverError === 'string') {
            errorMessage = serverError;
          }
        }

        console.error('[GroupsService] Error creating group:', {
          status: error.status,
          error: error.error,
          message: error.message,
          url: error.url,
          errorDetails: errorMessage
        });
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  updateGroup(group: IGroup): Observable<IGroup> {
    // Build the query parameters
    let params = new HttpParams()
      .set('NameGroup', group.nameGroup);

    if (group.musicGenreId) {
      params = params.set('MusicGenreId', group.musicGenreId.toString());
    }

    // If there is an existing image (imageGroup) and a new photo is not being uploaded,
    // We include it in the parameters to maintain it
    if (group.imageGroup && !group.photo) {
      params = params.set('ImageGroup', group.imageGroup);
    }

    // Create FormData only if there is a photo
    let formData: FormData | null = null;
    if (group.photo) {
      formData = new FormData();
      formData.append('Photo', group.photo);
    }

    // If there is a photo, we send it as multipart/form-data
    // If there is no photo but there is an existing image, the existing URL will be kept
    const body = formData || null;
    
    return this.http.put<IGroup>(
      `${this.baseUrl}Groups/${group.idGroup}`,  
      body,
      { 
        headers: body ? this.getHeaders('multipart/form-data') : this.getHeaders(),
        params,
        reportProgress: true
      }
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Error updating group';
        
        // Extract error message from server if available
        if (error.error?.errors) {
          // Handling ModelState validation errors
          const validationErrors = Object.entries(error.error.errors)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`)
            .join('; ');
          errorMessage = `Validation error: ${validationErrors}`;
        } else if (error.error) {
          // Handling other types of server errors
          const serverError = error.error;
          if (typeof serverError === 'object') {
            errorMessage = serverError.title || serverError.message || 
                         (serverError.error ? String(serverError.error) : 'Error desconocido del servidor');
          } else if (typeof serverError === 'string') {
            errorMessage = serverError;
          }
        }

        console.error('[GroupsService] Error updating group:', {
          status: error.status,
          error: error.error,
          message: error.message,
          url: error.url,
          errorDetails: errorMessage
        });
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }


  deleteGroup(id: number): Observable<IGroup> {
    const headers = this.getHeaders();
    return this.http.delete<IGroup>(`${this.baseUrl}groups/${id}`, {
      headers,
    });
  }

  getGroupName(idGroup: string | number): Observable<string> {
    const headers = this.getHeaders();
    return this.http
      .get<any>(`${this.baseUrl}groups/${idGroup}`, { headers })
      .pipe(
        map((response) => {

          // Handle direct group object
          if (
            response &&
            typeof response === 'object' &&
            'nameGroup' in response
          ) {
            return response.nameGroup;
          }

          // Handle $values wrapper
          if (
            response &&
            response.$values &&
            typeof response.$values === 'object'
          ) {
            if (
              Array.isArray(response.$values) &&
              response.$values.length > 0
            ) {
              return response.$values[0].nameGroup || '';
            }
            if ('nameGroup' in response.$values) {
              return response.$values.nameGroup;
            }
          }

          return '';
        })
      );
  }
}

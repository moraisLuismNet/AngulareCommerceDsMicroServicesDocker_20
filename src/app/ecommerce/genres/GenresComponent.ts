import { Component, ViewChild, inject, afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IGenre } from '../EcommerceInterface';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-genres',
    templateUrl: './GenresComponent.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        ConfirmDialogModule,
        DialogModule,
        InputTextModule
    ],
    providers: [ConfirmationService]
})
export class GenresComponent {
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('form') form!: NgForm;
  visibleError = false;
  errorMessage = '';
  genres: IGenre[] = [];
  filteredGenres: IGenre[] = [];
  visibleConfirm = false;
  searchTerm: string = '';

  genre: IGenre = {
    idMusicGenre: 0,
    nameMusicGenre: '',
  };

  constructor() {
    // Load genres immediately in the constructor
    this.getGenres();

    // afterNextRender runs once after the component is initially rendered
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });

  }

  getGenres() {
    this.genresService.getGenres().pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: (data: any) => {
        this.visibleError = false;
        
        // The API returns the array directly, no need to access .$values
        this.genres = Array.isArray(data) ? data : [];
        this.filteredGenres = [...this.genres]; // Initialize `filteredGenres` as a copy of `genres`
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }
  save() {
    if (this.genre.idMusicGenre === 0) {
      this.genresService.addGenre(this.genre).pipe(
        takeUntilDestroyed()
      ).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.form.reset();
          this.getGenres();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.log(err);
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
        },
      });
    } else {
      this.genresService.updateGenre(this.genre).pipe(
        takeUntilDestroyed()
      ).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.reset();
          this.getGenres();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  edit(genre: IGenre) {
    this.genre = { ...genre };
    this.cdr.markForCheck();
  }

  cancelEdition() {
    this.genre = {
      idMusicGenre: 0,
      nameMusicGenre: '',
    };
    this.cdr.markForCheck();
  }

  confirmDelete(genre: IGenre) {
    this.confirmationService.confirm({
      message: `Delete the genre ${genre.nameMusicGenre}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGenre(genre.idMusicGenre!),
    });
  }

  deleteGenre(id: number) {
    this.genresService.deleteGenre(id).pipe(
      takeUntilDestroyed()
    ).subscribe({
      next: (data) => {
        this.visibleError = false;
        this.form.reset({
          name: '',
        });
        this.getGenres();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  filterGenres() {
    const term = this.searchTerm.toLowerCase();
    this.filteredGenres = this.genres.filter((genre) =>
      genre.nameMusicGenre.toLowerCase().includes(term)
    );
    this.cdr.markForCheck();
  }
  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      // If `err.error` is a string, it is assumed to be the error message
      this.errorMessage = err.error;
    } else {
      // Handles the case where no useful error message is received
      this.errorMessage = 'An unexpected error has occurred';
    }
  }

}

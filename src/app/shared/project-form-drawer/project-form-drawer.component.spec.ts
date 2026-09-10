import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectFormDrawerComponent } from './project-form-drawer.component';

describe('ProjectFormDrawerComponent', () => {
  let component: ProjectFormDrawerComponent;
  let fixture: ComponentFixture<ProjectFormDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectFormDrawerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdeaBacklogComponent } from './idea-backlog.component';

describe('IdeaBacklogComponent', () => {
  let component: IdeaBacklogComponent;
  let fixture: ComponentFixture<IdeaBacklogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdeaBacklogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdeaBacklogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

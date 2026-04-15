import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-nosotros',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './nosotros.html',
    styleUrls: ['./nosotros.scss']
})
export class NosotrosComponent implements OnInit {

    ngOnInit(): void {
        window.scrollTo({ top: 0 });
        this.animateOnScroll();
    }

    animateOnScroll(): void {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.08, rootMargin: '0px 0px -50px 0px' }
        );
        setTimeout(() => {
            document.querySelectorAll('.nos-animate').forEach((el, i) => {
                (el as HTMLElement).style.setProperty('--si', String(i % 6));
                observer.observe(el);
            });
        }, 100);
    }

    contactarWhatsApp(msg: string): void {
        const phone = '573162987496';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

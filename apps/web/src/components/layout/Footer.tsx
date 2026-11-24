import { GGG_DISCLAIMER, POE_NINJA_ATTRIBUTION } from '@poelens/shared';

export function Footer() {
    return (
        <footer className="border-t">
            <div className="text-muted-foreground flex w-full flex-col gap-1 px-4 py-6 text-xs md:px-8">
                <p>{GGG_DISCLAIMER}</p>
                <p>{POE_NINJA_ATTRIBUTION}</p>
            </div>
        </footer>
    );
}

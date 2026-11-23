import { GGG_DISCLAIMER, POE_NINJA_ATTRIBUTION } from '@poelens/shared';

export function Footer() {
    return (
        <footer className="border-t">
            <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-xs">
                <p>{GGG_DISCLAIMER}</p>
                <p>{POE_NINJA_ATTRIBUTION}</p>
            </div>
        </footer>
    );
}

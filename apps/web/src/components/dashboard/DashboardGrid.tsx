import { GRID_COLUMNS, GRID_GAP_PX, GRID_ROW_PX, phoneOrder, tabletFlow, type BlockData, type Panel as PanelModel } from '@poelens/shared';
import { useMemo, useRef } from 'react';
import { moveByPixels, resizeByPixels, toColumnWidth } from '@/lib/dashboard/geometry';
import { GridPanel } from '@/motion/GridPanel';
import { PanelGestures, type GestureHandlers } from './dnd';
import { PanelBar, ResizeHandle } from './edit/PanelChrome';
import { Panel, type PanelMode } from './Panel';
import { useElementWidth } from './use-grid-width';
import { usePanelKeyboard } from './use-panel-keyboard';
import { useGridTier } from './use-grid-tier';

function HiddenOnPhone({ panels }: { panels: readonly PanelModel[] }) {
    if (panels.length === 0) return null;

    return <p className="text-muted-foreground text-[13px]">Hidden on phone: {panels.map((panel) => panel.title).join(', ')}</p>;
}

/** Twelve faint columns behind the panels while the layout is edited, so a panel's size reads in columns. */
function Guides() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`, gap: GRID_GAP_PX }}
        >
            {Array.from({ length: GRID_COLUMNS }, (_, index) => (
                <span key={index} className="bg-primary/[0.06] rounded-md" />
            ))}
        </div>
    );
}

interface GridProps {
    panels: readonly PanelModel[];
    data: Record<string, BlockData | null> | undefined;
    mode: PanelMode;
    /** In content mode, the panel being edited and the block whose settings are open. */
    selectedId?: string | null;
    openBlockId?: string | null;
    onLayout: (panels: PanelModel[]) => void;
    /** Absent where the dashboard cannot be edited, which also leaves out each panel's menu. */
    onEditContent?: (panelId: string) => void;
}

/** On a phone: one column in reading order, each panel as tall as its blocks, and the hidden ones named at the bottom. */
function PhoneStack({ panels, data, mode, selectedId, openBlockId, onEditContent }: GridProps) {
    const shown = phoneOrder(panels).filter((panel) => !panel.hideOnPhone);

    return (
        <div className="flex flex-col gap-4">
            {shown.map((panel) => (
                <section key={panel.id} aria-label={panel.title}>
                    <Panel
                        panel={panel}
                        data={data}
                        mode={mode}
                        selected={panel.id === selectedId}
                        openBlockId={openBlockId}
                        fitContent
                        onEditContent={onEditContent && (() => onEditContent(panel.id))}
                    />
                </section>
            ))}
            <HiddenOnPhone panels={panels.filter((panel) => panel.hideOnPhone)} />
        </div>
    );
}

/** On a tablet: two columns, a panel up to half the grid wide taking one and a wider one the row, hidden panels included. */
function TabletFlow({ panels, data, mode, selectedId, openBlockId, onEditContent }: GridProps) {
    return (
        <div className="grid grid-cols-2 gap-4">
            {tabletFlow(panels).map(({ item, span }) => (
                <section key={item.id} aria-label={item.title} className={span === 2 ? 'col-span-2' : undefined}>
                    <Panel
                        panel={item}
                        data={data}
                        mode={mode}
                        selected={item.id === selectedId}
                        openBlockId={openBlockId}
                        fitContent
                        onEditContent={onEditContent && (() => onEditContent(item.id))}
                    />
                </section>
            ))}
        </div>
    );
}

/** The 12-column grid on a desktop. In Layout mode its panels can be dragged, resized and moved from the keyboard. */
function WideGrid({ panels, data, mode, selectedId, openBlockId, onLayout, onEditContent }: GridProps) {
    const { ref, width } = useElementWidth<HTMLDivElement>();
    const keyboard = usePanelKeyboard(panels, onLayout);
    const latest = useRef({ panels, width, onLayout });
    const start = useRef<readonly PanelModel[]>([]);

    latest.current = { panels, width, onLayout };

    const handlers = useMemo<GestureHandlers>(
        () => ({
            onStart: () => {
                start.current = latest.current.panels;
            },
            onMove: (id, kind, dx, dy) => {
                const { width: gridWidth, onLayout: apply } = latest.current;
                const next = kind === 'move' ? moveByPixels : resizeByPixels;

                apply(next(start.current, id, dx, dy, toColumnWidth(gridWidth)));
            },
            onEnd: (_id, _kind, canceled) => {
                if (canceled) latest.current.onLayout([...start.current]);
            },
        }),
        [],
    );

    return (
        <PanelGestures handlers={handlers}>
            <div
                ref={ref}
                className="relative grid"
                style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`, gridAutoRows: GRID_ROW_PX, gap: GRID_GAP_PX }}
            >
                {mode === 'layout' && <Guides />}
                {panels.map((panel) => (
                    <GridPanel
                        key={panel.id}
                        label={panel.title}
                        animate
                        className="relative z-[1] min-h-0"
                        style={{ gridColumn: `${panel.x + 1} / span ${panel.w}`, gridRow: `${panel.y + 1} / span ${panel.h}` }}
                    >
                        <Panel
                            panel={panel}
                            data={data}
                            mode={mode}
                            selected={panel.id === selectedId}
                            openBlockId={openBlockId}
                            fitContent={false}
                            onEditContent={onEditContent && (() => onEditContent(panel.id))}
                            bar={
                                <PanelBar
                                    panel={panel}
                                    picked={keyboard.pickedId === panel.id}
                                    onKeyDown={(event) => keyboard.onKeyDown(panel, event)}
                                    onBlur={keyboard.drop}
                                    onEditContent={() => onEditContent?.(panel.id)}
                                />
                            }
                            resizeHandle={<ResizeHandle panel={panel} />}
                        />
                    </GridPanel>
                ))}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
                {keyboard.status}
            </div>
        </PanelGestures>
    );
}

/** The panels of a dashboard: a grid on a desktop, a two-column flow on a tablet and one column on a phone. */
export function DashboardGrid(props: GridProps) {
    const tier = useGridTier();

    if (tier === 'phone') return <PhoneStack {...props} />;

    if (tier === 'tablet') return <TabletFlow {...props} />;

    return <WideGrid {...props} />;
}

import type { CojsonInternalTypes, RawCoValue } from "cojson";
import { RawAccount } from "cojson";
import type { DeeplyLoaded, DepthsIn } from "../internal.js";
import {
    Account,
    Group,
    SubscriptionScope,
    Ref,
    inspect,
    subscriptionsScopes,
} from "../internal.js";
import { fulfillsDepth } from "./deepLoading.js";

/** @category Abstract interfaces */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CoValueClass<Value extends CoValue = CoValue> {
    /** @ignore */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): Value;
}

export interface CoValueFromRaw<V extends CoValue> {
    fromRaw(raw: V["_raw"]): V;
}

/** @category Abstract interfaces */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CoValue {
    /** @category Content */
    readonly id: ID<this>;
    /** @category Type Helpers */
    _type: string;
    /** @category Collaboration */
    _owner: Account | Group;
    /** @category Internals */
    _raw: RawCoValue;
    /** @internal */
    readonly _loadedAs: Account;
    /** @category Stringifying & Inspection */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toJSON(key?: string, seenAbove?: ID<CoValue>[]): any[] | object | string;
    /** @category Stringifying & Inspection */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [inspect](): any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCoValue(value: any): value is CoValue {
    return value && value._type !== undefined;
}

export function isCoValueClass<V extends CoValue>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): value is CoValueClass<V> & CoValueFromRaw<V> {
    return typeof value === "function" && value.fromRaw !== undefined;
}

/** @category CoValues */
export type ID<T> = CojsonInternalTypes.RawCoID & IDMarker<T>;

type IDMarker<out T> = { __type(_: never): T };

/** @internal */
export class CoValueBase implements CoValue {
    id!: ID<this>;
    _type!: string;
    _raw!: RawCoValue;
    /** @category Internals */
    _instanceID!: string;

    get _owner(): Account | Group {
        const owner =
            this._raw.group instanceof RawAccount
                ? Account.fromRaw(this._raw.group)
                : Group.fromRaw(this._raw.group);

        const subScope = subscriptionsScopes.get(this);
        if (subScope) {
            subScope.onRefAccessedOrSet(this.id, owner.id);
            subscriptionsScopes.set(owner, subScope);
        }

        return owner;
    }

    /** @private */
    get _loadedAs() {
        return Account.fromNode(this._raw.core.node);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(..._args: any) {
        Object.defineProperty(this, "_instanceID", {
            value: `instance-${Math.random().toString(36).slice(2)}`,
            enumerable: false,
        });
    }

    /** @category Internals */
    static fromRaw<V extends CoValue>(
        this: CoValueClass<V>,
        raw: RawCoValue,
    ): V {
        return new this({ fromRaw: raw });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toJSON(): object | any[] | string {
        return {
            id: this.id,
            type: this._type,
            error: "unknown CoValue class",
        };
    }

    [inspect]() {
        return this.toJSON();
    }

    /** @category Type Helpers */
    castAs<Cl extends CoValueClass & CoValueFromRaw<CoValue>>(
        cl: Cl,
    ): InstanceType<Cl> {
        const casted = cl.fromRaw(this._raw) as InstanceType<Cl>;
        const subscriptionScope = subscriptionsScopes.get(this);
        if (subscriptionScope) {
            subscriptionsScopes.set(casted, subscriptionScope);
        }
        return casted;
    }
}

export function loadCoValue<V extends CoValue, Depth>(
    cls: CoValueClass<V>,
    id: ID<V>,
    as: Account,
    depth: Depth & DepthsIn<V>,
): Promise<DeeplyLoaded<V, Depth> | undefined> {
    return new Promise((resolve) => {
        const unsubscribe = subscribeToCoValue(
            cls,
            id,
            as,
            depth,
            (value) => {
                resolve(value);
                unsubscribe();
            },
            () => {
                resolve(undefined);
                unsubscribe();
            },
        );
    });
}

export function ensureCoValueLoaded<V extends CoValue, Depth>(
    existing: V,
    depth: Depth & DepthsIn<V>,
): Promise<DeeplyLoaded<V, Depth> | undefined> {
    return loadCoValue(
        existing.constructor as CoValueClass<V>,
        existing.id,
        existing._loadedAs,
        depth,
    );
}

export function subscribeToCoValue<V extends CoValue, Depth>(
    cls: CoValueClass<V>,
    id: ID<V>,
    as: Account,
    depth: Depth & DepthsIn<V>,
    listener: (value: DeeplyLoaded<V, Depth>) => void,
    onUnavailable?: () => void,
): () => void {
    const ref = new Ref(id, as, { ref: cls, optional: false });

    let unsubscribed = false;
    let unsubscribe: (() => void) | undefined;

    ref.load()
        .then((value) => {
            if (!value) {
                onUnavailable && onUnavailable();
                return;
            }
            if (unsubscribed) return;
            const subscription = new SubscriptionScope(
                value,
                cls as CoValueClass<V> & CoValueFromRaw<V>,
                (update) => {
                    if (fulfillsDepth(depth, update)) {
                        listener(update as DeeplyLoaded<V, Depth>);
                    }
                },
            );

            unsubscribe = () => subscription.unsubscribeAll();
        })
        .catch((e) => {
            console.error("Failed to load / subscribe to CoValue", e);
        });

    return function unsubscribeAtAnyPoint() {
        unsubscribed = true;
        unsubscribe && unsubscribe();
    };
}

export function subscribeToExistingCoValue<V extends CoValue, Depth>(
    existing: V,
    depth: Depth & DepthsIn<V>,
    listener: (value: DeeplyLoaded<V, Depth>) => void,
): () => void {
    return subscribeToCoValue(
        existing.constructor as CoValueClass<V>,
        existing.id,
        existing._loadedAs,
        depth,
        listener,
    );
}

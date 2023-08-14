import { JsonObject, JsonValue } from '../jsonValue.js';
import { TransactionID } from '../ids.js';
import { CoValueID } from '../contentType.js';
import { CoValue } from '../coValue.js';

type MapOp<K extends string, V extends JsonValue> = {
    txID: TransactionID;
    madeAt: number;
    changeIdx: number;
} & MapOpPayload<K, V>;
// TODO: add after TransactionID[] for conflicts/ordering

export type MapOpPayload<K extends string, V extends JsonValue> = {
    op: "insert";
    key: K;
    value: V;
} |
{
    op: "delete";
    key: K;
};

export class CoMap<
    M extends { [key: string]: JsonValue; },
    Meta extends JsonValue,
    K extends string = keyof M & string,
    V extends JsonValue = M[K],
    MM extends { [key: string]: JsonValue; } = {
        [KK in K]: M[KK];
    }
> {
    id: CoValueID<CoMap<MM, Meta>>;
    coValue: CoValue;
    type = "comap" as const;
    ops: {
        [KK in K]?: MapOp<K, M[KK]>[];
    };

    constructor(coValue: CoValue) {
        this.id = coValue.id as CoValueID<CoMap<MM, Meta>>;
        this.coValue = coValue;
        this.ops = {};

        this.fillOpsFromCoValue();
    }

    protected fillOpsFromCoValue() {
        this.ops = {};

        for (const { txID, changes, madeAt } of this.coValue.getValidSortedTransactions()) {
            for (const [changeIdx, changeUntyped] of (
                changes
            ).entries()) {
                const change = changeUntyped as MapOpPayload<K, V>;
                let entries = this.ops[change.key];
                if (!entries) {
                    entries = [];
                    this.ops[change.key] = entries;
                }
                entries.push({
                    txID,
                    madeAt,
                    changeIdx,
                    ...(change as MapOpPayload<K, M[K]>),
                });
            }
        }
    }

    keys(): K[] {
        return Object.keys(this.ops) as K[];
    }

    get<KK extends K>(key: KK): M[KK] | undefined {
        const ops = this.ops[key];
        if (!ops) {
            return undefined;
        }

        const lastEntry = ops[ops.length - 1]!;

        if (lastEntry.op === "delete") {
            return undefined;
        } else {
            return lastEntry.value;
        }
    }

    getAtTime<KK extends K>(key: KK, time: number): M[KK] | undefined {
        const ops = this.ops[key];
        if (!ops) {
            return undefined;
        }

        const lastOpBeforeOrAtTime = ops.findLast((op) => op.madeAt <= time);

        if (!lastOpBeforeOrAtTime) {
            return undefined;
        }

        if (lastOpBeforeOrAtTime.op === "delete") {
            return undefined;
        } else {
            return lastOpBeforeOrAtTime.value;
        }
    }

    getLastTxID<KK extends K>(key: KK): TransactionID | undefined {
        const ops = this.ops[key];
        if (!ops) {
            return undefined;
        }

        const lastEntry = ops[ops.length - 1]!;

        return lastEntry.txID;
    }

    getLastEntry<KK extends K>(key: KK): { at: number; txID: TransactionID; value: M[KK]; } | undefined {
        const ops = this.ops[key];
        if (!ops) {
            return undefined;
        }

        const lastEntry = ops[ops.length - 1]!;

        if (lastEntry.op === "delete") {
            return undefined;
        } else {
            return { at: lastEntry.madeAt, txID: lastEntry.txID, value: lastEntry.value };
        }
    }

    getHistory<KK extends K>(key: KK): { at: number; txID: TransactionID; value: M[KK] | undefined; }[] {
        const ops = this.ops[key];
        if (!ops) {
            return [];
        }

        const history: { at: number; txID: TransactionID; value: M[KK] | undefined; }[] = [];

        for (const op of ops) {
            if (op.op === "delete") {
                history.push({ at: op.madeAt, txID: op.txID, value: undefined });
            } else {
                history.push({ at: op.madeAt, txID: op.txID, value: op.value });
            }
        }

        return history;
    }

    toJSON(): JsonObject {
        const json: JsonObject = {};

        for (const key of this.keys()) {
            const value = this.get(key);
            if (value !== undefined) {
                json[key] = value;
            }
        }

        return json;
    }

    edit(changer: (editable: WriteableCoMap<M, Meta>) => void): CoMap<M, Meta> {
        const editable = new WriteableCoMap<M, Meta>(this.coValue);
        changer(editable);
        return new CoMap(this.coValue);
    }

    subscribe(listener: (coMap: CoMap<M, Meta>) => void): () => void {
        return this.coValue.subscribe((content) => {
            listener(content as CoMap<M, Meta>);
        });
    }
}

export class WriteableCoMap<
    M extends { [key: string]: JsonValue; },
    Meta extends JsonValue,
    K extends string = keyof M & string,
    V extends JsonValue = M[K],
    MM extends { [key: string]: JsonValue; } = {
        [KK in K]: M[KK];
    }
> extends CoMap<M, Meta, K, V, MM> {
    set<KK extends K>(key: KK, value: M[KK], privacy: "private" | "trusting" = "private"): void {
        this.coValue.makeTransaction([
            {
                op: "insert",
                key,
                value,
            },
        ], privacy);

        this.fillOpsFromCoValue();
    }

    delete(key: K, privacy: "private" | "trusting" = "private"): void {
        this.coValue.makeTransaction([
            {
                op: "delete",
                key,
            },
        ], privacy);

        this.fillOpsFromCoValue();
    }
}

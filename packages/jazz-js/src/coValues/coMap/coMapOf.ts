import {
    ID,
    isCoValueSchema,
    isCoValue,
    CoValue,
    inspect,
    CoValueSchema,
} from "../../coValueInterfaces.js";
import {
    CoMapFields,
    CoMapCo,
    CoMapInit,
    CoMapSchema,
    CoMap,
    IndexSignature,
} from "./coMap.js";
import { makeRefs } from "../../refs.js";
import { JsonValue, RawCoMap } from "cojson";
import { Group } from "../group/group.js";
import { Account } from "../account/account.js";
import { controlledAccountFromNode } from "../account/accountOf.js";
import { subscriptionsScopes } from "../../subscriptionScope.js";
import { AST, Schema } from "@effect/schema";
import {
    constructorOfSchemaSym,
    propertyIsCoValueSchema,
} from "../resolution.js";
import { JsonObject } from "cojson/src/jsonValue.js";
import { CoValueCoImpl, SharedCoValueConstructor } from "../construction.js";
import {
    PropertySignatureWithInput,
    SchemaWithInputAndOutput,
    SchemaWithOutput,
} from "../../schemaHelpers.js";
import { pipeArguments } from "effect/Pipeable";

export function CoMapOf<
    Fields extends CoMapFields,
    IndexSig extends IndexSignature,
>(fields: Fields, indexSignature?: IndexSig) {
    class CoMapOfFields
        extends SharedCoValueConstructor
        implements CoValue<"CoMap", RawCoMap>
    {
        static get ast() {
            return AST.setAnnotation(
                Schema.instanceOf(this).ast,
                constructorOfSchemaSym,
                this
            );
        }
        static [Schema.TypeId]: Schema.Schema.Variance<
            CoMapOfFields,
            CoMapOfFields,
            never
        >[Schema.TypeId];
        static pipe() {
            // eslint-disable-next-line prefer-rest-params
            return pipeArguments(this, arguments);
        }
        static type = "CoMap" as const;

        co!: CoMapCo<this, Fields, IndexSig>;

        constructor(_init: undefined, options: { fromRaw: RawCoMap });
        constructor(
            init: CoMapInit<Fields>,
            options: { owner: Account | Group }
        );
        constructor(
            init: CoMapInit<Fields> | undefined,
            options: { owner: Account | Group } | { fromRaw: RawCoMap }
        ) {
            super();

            let raw: RawCoMap;

            if ("fromRaw" in options) {
                raw = options.fromRaw;
            } else {
                const rawOwner = options.owner.co.raw;

                const rawInit = {} as {
                    [key in keyof CoMapInit<Fields>]: JsonValue | undefined;
                };

                if (init)
                    for (const key of Object.keys(
                        init
                    ) as (keyof CoMapInit<Fields>)[]) {
                        const initValue = init[key];
                        const field =
                            fields[key] ||
                            (indexSignature &&
                                Schema.is(indexSignature.key)(key) &&
                                indexSignature.value);

                        if (!field) {
                            throw new Error(`Key ${String(key)} not in schema`);
                        }

                        if (propertyIsCoValueSchema(field)) {
                            // TOOD: check for alignment of actual value with schema
                            if (isCoValue(initValue)) {
                                rawInit[key] = initValue.co.id;
                            } else {
                                throw new Error(
                                    `Expected covalue in ${String(
                                        key
                                    )} but got ${initValue}`
                                );
                            }
                        } else {
                            const fieldSchema = (
                                "propertySignatureAST" in field
                                    ? Schema.make<JsonObject, any, never>(
                                          (
                                              field.propertySignatureAST as {
                                                  from: AST.AST;
                                              }
                                          ).from
                                      )
                                    : field
                            ) as Schema.Schema<JsonObject, any, never>;
                            rawInit[key] =
                                Schema.encodeSync(fieldSchema)(initValue);
                        }
                    }

                raw = rawOwner.createMap(rawInit);
            }

            for (const key of Object.keys(fields) as (keyof Fields)[]) {
                if (typeof key !== "string") continue;

                const fieldSchema = fields[key]!;
                if (propertyIsCoValueSchema(fieldSchema)) {
                    Object.defineProperty(this, key, {
                        get(this: CoMapOfFields) {
                            return this.getCoValueAtKey(key);
                        },
                        set(this: CoMapOfFields, value) {
                            this.setCoValueAtKey(key, value);
                        },
                        enumerable: true,
                    });
                } else {
                    Object.defineProperty(this, key, {
                        get(this: CoMapOfFields) {
                            return this.getPrimitiveAtKey(key, fieldSchema);
                        },
                        set(this: CoMapOfFields, value) {
                            this.setPrimitiveAtKey(key, value, fieldSchema);
                        },
                        enumerable: true,
                    });
                }
            }

            const fieldsThatAreRefs = Object.entries(fields)
                .filter(([_, value]) => isCoValueSchema(value))
                .map(([key]) => key);

            const refs = makeRefs<
                {
                    [Key in keyof Fields]: Fields[Key] extends CoValueSchema
                        ? Exclude<Schema.Schema.To<Fields[Key]>, undefined>
                        : never;
                } & {
                    [Key in Schema.Schema.To<IndexSig["key"]>]: Exclude<
                        Schema.Schema.To<IndexSig["value"]>,
                        undefined
                    >;
                }
            >(
                (key) => {
                    return raw.get(key as string) as
                        | ID<
                              Schema.Schema.To<
                                  Fields[typeof key] & CoValueSchema
                              >
                          >
                        | undefined;
                },
                () => {
                    if (indexSignature) {
                        return raw
                            .keys()
                            .filter(
                                (key) =>
                                    fieldsThatAreRefs.includes(key) ||
                                    Schema.is(indexSignature.key)(key)
                            );
                    } else {
                        return fieldsThatAreRefs;
                    }
                },
                controlledAccountFromNode(raw.core.node),
                (key) =>
                    fields[key] ||
                    (indexSignature
                        ? indexSignature.value
                        : (() => {
                              throw new Error(
                                  "Expected " + String(key) + " to be valid"
                              );
                          })())
            );

            Object.defineProperty(this, "co", {
                value: new CoValueCoImpl(
                    raw.id as unknown as ID<this & CoMap<Fields, IndexSig>>,
                    "CoMap",
                    raw,
                    this.constructor as CoMapSchema<
                        this & CoMap<Fields, IndexSig>,
                        Fields,
                        IndexSig
                    >,
                    refs as any
                ) satisfies CoMapCo<
                    this & CoMap<Fields, IndexSig>,
                    Fields,
                    IndexSig
                >,
                writable: false,
                enumerable: false,
            });

            if (indexSignature) {
                return new Proxy(this, {
                    get(target, key) {
                        if (key in target) {
                            return Reflect.get(target, key);
                        } else {
                            if (Schema.is(indexSignature.key)(key as string)) {
                                if (
                                    propertyIsCoValueSchema(
                                        indexSignature.value
                                    )
                                ) {
                                    return target.getCoValueAtKey(
                                        key as string
                                    );
                                } else {
                                    return target.getPrimitiveAtKey(
                                        key as string,
                                        indexSignature.value
                                    );
                                }
                            } else {
                                throw new Error(
                                    "No such key " + String(key) + " in CoMap"
                                );
                            }
                        }
                    },
                    set(target, key, value) {
                        if (key in target) {
                            return Reflect.set(target, key, value);
                        } else if (
                            Schema.is(indexSignature.key)(key as string)
                        ) {
                            if (propertyIsCoValueSchema(indexSignature.value)) {
                                target.setCoValueAtKey(key as string, value);
                            } else {
                                target.setPrimitiveAtKey(
                                    key as string,
                                    value,
                                    indexSignature.value
                                );
                            }
                            return true;
                        } else {
                            throw new Error(
                                "No such key " + String(key) + " in CoMap"
                            );
                        }
                    },
                    ownKeys(target) {
                        const keys = Reflect.ownKeys(target);
                        for (const key of target.co.raw.keys()) {
                            if (!keys.includes(key)) {
                                if (
                                    Schema.is(indexSignature.key)(key as string)
                                ) {
                                    keys.push(key);
                                }
                            }
                        }
                        return keys;
                    },
                    getOwnPropertyDescriptor(target, key) {
                        if (key in target) {
                            return Reflect.getOwnPropertyDescriptor(
                                target,
                                key
                            );
                        } else if (
                            Schema.is(indexSignature.key)(key as string)
                        ) {
                            return {
                                enumerable: true,
                                configurable: true,
                            };
                        }
                    },
                });
            }
        }

        static fromRaw(raw: RawCoMap): CoMapOfFields {
            return new CoMapOfFields(undefined, { fromRaw: raw });
        }

        private getCoValueAtKey(key: string) {
            return this.co.refs[key]?.accessFrom(this);
        }

        private setCoValueAtKey(key: string, value: CoValue) {
            this.co.raw.set(key, value.co.id);
            subscriptionsScopes.get(this)?.onRefAccessedOrSet(value.co.id);
        }

        private getPrimitiveAtKey(
            key: string,
            schemaAtKey:
                | Schema.Schema<any, JsonValue | undefined, never>
                | PropertySignatureWithInput<JsonValue>
        ) {
            if ("ast" in schemaAtKey) {
                return Schema.decodeSync(schemaAtKey)(this.co.raw.get(key));
            } else {
                const ast = (
                    schemaAtKey as unknown as {
                        propertySignatureAST: { from: AST.AST };
                    }
                ).propertySignatureAST;
                const schema = Schema.make<
                    JsonValue | undefined,
                    JsonValue | undefined,
                    never
                >(ast.from);
                return Schema.decodeSync(schema)(this.co.raw.get(key));
            }
        }

        private setPrimitiveAtKey(
            key: string,
            value: any,
            schemaAtKey:
                | Schema.Schema<any, JsonValue | undefined, never>
                | PropertySignatureWithInput<JsonValue>
        ) {
            if ("ast" in schemaAtKey) {
                this.co.raw.set(
                    key,
                    Schema.encodeSync(schemaAtKey)(value) as
                        | JsonValue
                        | undefined
                );
            } else {
                const ast = (
                    schemaAtKey as unknown as {
                        propertySignatureAST: { from: AST.AST };
                    }
                ).propertySignatureAST;
                const schema = Schema.make<
                    JsonValue | undefined,
                    JsonValue | undefined,
                    never
                >(ast.from);
                this.co.raw.set(
                    key,
                    Schema.encodeSync(schema)(value) as JsonValue | undefined
                );
            }
        }

        toJSON() {
            return {
                ...Object.fromEntries(
                    Object.entries(this).flatMap(([key, value]) =>
                        typeof value === "object" && "toJSON" in value
                            ? [[key, value?.toJSON()]]
                            : [[key, value]]
                    )
                ),
                co: {
                    id: this.co.id,
                    type: "CoMap",
                },
            };
        }

        [inspect]() {
            return this.toJSON();
        }

        static as<SubClass>() {
            return CoMapOfFields as unknown as CoMapSchema<SubClass, Fields, IndexSig>;
        }
    }

    return CoMapOfFields as CoMapSchema<CoMapOfFields, Fields, IndexSig> & {
        as<SubClass>(): CoMapSchema<SubClass, Fields, IndexSig>;
    };
}

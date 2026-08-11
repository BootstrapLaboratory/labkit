/**
 * @generated SignedSource<<27d1eac09f28e2530ec4098ae5d60f7e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LifecycleItemQuery$variables = {
  id: string;
};
export type LifecycleItemQuery$data = {
  readonly item: {
    readonly id: string;
    readonly label: string;
  };
};
export type LifecycleItemQuery = {
  response: LifecycleItemQuery$data;
  variables: LifecycleItemQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Item",
    "kind": "LinkedField",
    "name": "item",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "label",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LifecycleItemQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LifecycleItemQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bda7ccc6d5bca03f978e225a51b56338",
    "id": null,
    "metadata": {},
    "name": "LifecycleItemQuery",
    "operationKind": "query",
    "text": "query LifecycleItemQuery(\n  $id: ID!\n) {\n  item(id: $id) {\n    id\n    label\n  }\n}\n"
  }
};
})();

(node as any).hash = "b13a1f127d645c1f0ea2a4602a40178c";

export default node;

import * as ts from "typescript";
import * as tstl from "typescript-to-lua";
import { FunctionVisitor, TransformationContext } from "typescript-to-lua";
import { transformClassInstanceFields } from "typescript-to-lua/dist/transformation/visitors/class/members/fields";
import {
	getExtendedNode,
	isStaticNode,
} from "typescript-to-lua/dist/transformation/visitors/class/utils";
import {
	transformFunctionBodyContent,
	transformFunctionToExpression,
} from "typescript-to-lua/dist/transformation/visitors/function";

import {
	popScope,
	pushScope,
	ScopeType,
} from "typescript-to-lua/dist/transformation/utils/scope";
import { transformCallAndArguments } from "typescript-to-lua/dist/transformation/visitors/call";

function createClassCall(
	context: tstl.TransformationContext,
	className: tstl.Identifier,
	extendsNode?: ts.ExpressionWithTypeArguments
): tstl.Statement {
	// class('X')
	const classCall = tstl.createCallExpression(tstl.createIdentifier("class"), [
		tstl.createStringLiteral(className.text),
	]);
	let classCreationExpression: tstl.Expression = classCall;
	if (extendsNode) {
		// class('X').extends(Blah)
		classCreationExpression = tstl.createCallExpression(
			tstl.createTableIndexExpression(
				classCall,
				tstl.createStringLiteral("extends")
			),
			[context.transformExpression(extendsNode.expression)]
		);
	} else {
		classCreationExpression = classCall;
	}
	return tstl.createExpressionStatement(classCreationExpression);
}

export function transformPropertyName(
	context: TransformationContext,
	node: ts.PropertyName
): tstl.Expression {
	if (ts.isComputedPropertyName(node)) {
		return context.transformExpression(node.expression);
	} else if (ts.isIdentifier(node)) {
		return tstl.createStringLiteral(node.text);
	} else if (ts.isPrivateIdentifier(node)) {
		throw new Error("PrivateIdentifier is not supported");
	} else {
		return context.transformExpression(node);
	}
}

function transformConstructor(
	context: TransformationContext,
	className: tstl.Identifier,
	instanceFields: ts.PropertyDeclaration[],
	constructor?: ts.ConstructorDeclaration
): tstl.Statement | undefined {
	const methodName = "init";
	const scope = pushScope(context, ScopeType.Function);
	const bodyStatements: tstl.Statement[] = [];
	bodyStatements.push(
		tstl.createExpressionStatement(
			tstl.createCallExpression(
				tstl.createTableIndexExpression(
					tstl.createTableIndexExpression(
						className,
						tstl.createStringLiteral("super")
					),
					tstl.createStringLiteral("init")
				),
				[tstl.createIdentifier("self")]
			)
		)
	);
	const classInstanceFields = transformClassInstanceFields(
		context,
		instanceFields
	);
	// initializers have to come before any body of the constructor
	bodyStatements.push(...classInstanceFields);
	if (constructor?.body) {
		const body = transformFunctionBodyContent(context, constructor.body);
		// slice off the super call.
		// TODO: typescript will "make" you do a super call, but what happens if there is not one?
		bodyStatements.push(...body.slice(1));
	}
	popScope(context);
	return tstl.createAssignmentStatement(
		tstl.createTableIndexExpression(
			className,
			tstl.createStringLiteral(methodName)
		),
		tstl.createFunctionExpression(tstl.createBlock(bodyStatements), [
			tstl.createIdentifier("self"),
		])
	);
}

function transformMethodDeclaration(
	context: TransformationContext,
	node: ts.MethodDeclaration,
	className: tstl.Identifier
): tstl.Statement | undefined {
	const [functionExpression] = transformFunctionToExpression(context, node);
	return tstl.createAssignmentStatement(
		tstl.createTableIndexExpression(
			className,
			transformPropertyName(context, node.name)
		),
		functionExpression
	);
}

export const transformClassDeclaration: FunctionVisitor<
	ts.ClassLikeDeclaration
> = (declaration, context) => {
	let className: tstl.Identifier;
	if (declaration.name) {
		className = tstl.createIdentifier(declaration.name.text);
	} else {
		className = tstl.createIdentifier(
			context.createTempName("class"),
			declaration
		);
	}

	const extension = getExtendedNode(context, declaration);

	// Get all properties with value
	const properties = declaration.members
		.filter(ts.isPropertyDeclaration)
		.filter((member) => member.initializer);

	// Divide properties into static and non-static
	const instanceFields = properties.filter((prop) => !isStaticNode(prop));

	const statements: tstl.Statement[] = [];

	// class('X')
	statements.push(createClassCall(context, className, extension));

	// function X:init()
	//   X.super.init(self)
	// end
	const constructor = declaration.members.find(
		(n): n is ts.ConstructorDeclaration =>
			ts.isConstructorDeclaration(n) && n.body !== undefined
	);
	debugger;
	const transformedConstructor = transformConstructor(
		context,
		className,
		instanceFields,
		constructor
	);
	if (transformedConstructor) {
		statements.push(transformedConstructor);
	}

	const methods = declaration.members
		.filter(ts.isMethodDeclaration)
		.map((method) => transformMethodDeclaration(context, method, className))
		.filter((method): method is tstl.Statement => method !== undefined);
	statements.push(...methods);

	return statements;
};

const transformNewExpression: FunctionVisitor<ts.NewExpression> = (
	node,
	context
) => {
	const signature = context.checker.getResolvedSignature(node);
	const [name, params] = transformCallAndArguments(
		context,
		node.expression,
		node.arguments ?? [ts.factory.createTrue()],
		signature
	);
	return tstl.createCallExpression(name, params);
};

const plugin: tstl.Plugin = {
	visitors: {
		[ts.SyntaxKind.ClassDeclaration]: transformClassDeclaration,
		[ts.SyntaxKind.NewExpression]: transformNewExpression,
		// thanks to @orta
		[ts.SyntaxKind.CallExpression]: (node, context) => {
			console.log("transforming call");
			if (
				ts.isIdentifier(node.expression) &&
				node.expression.escapedText === "require"
			) {
				const normalNode = context.superTransformExpression(node);
				// @ts-ignore
				normalNode.expression.text = "import";
				// @ts-ignore
				normalNode.expression.originalName = "import";
				return normalNode;
			} else {
				return context.superTransformExpression(node);
			}
		},
	},
};
export default plugin;

import { FieldInputNode, NumberNode, SliderNode, IntegerNode, BooleanNode, DomainNode } from './nodes/number'
import { ToggleNode, ColourNode, ValueListNode, DomainSliderNode, ButtonNode } from './nodes/params'
import {
  AdditionNode, SubtractionNode, MultiplicationNode, DivisionNode, NegativeNode, PowerNode,
  AbsoluteNode, IntegerDivisionNode, FactorialNode, ModulusNode,
  SineNode, CosineNode, TangentNode,
  FloorNode, CeilingNode, RoundNode,
  MaximumNode, MinimumNode, AverageNode,
  MassAdditionNode, MassMultiplicationNode, RelativeDifferencesNode,
  LargerThanNode, SmallerThanNode, EqualityNode, SimilarityNode,
  GateAndNode, GateOrNode, GateNotNode, GateXorNode,
  GateMajorityNode, GateNandNode, GateNorNode, GateXnorNode,
  RemapNode, ExpressionNode, RangeNode, SeriesNode,
} from './nodes/math'
import { PointNode, LineNode, DeconstructPointNode, DistanceNode } from './nodes/geometry'
import { VectorNode, UnitVectorNode, VectorLengthNode, CrossProductNode, DotProductNode, MoveNode } from './nodes/vector'
import { LineSDLNode, CircleNode, ArcNode, PolyLineNode, DivideCurveNode, ExplodeNode } from './nodes/curve'
import { PlaneNode, PlaneOriginNode, ExtrudeNode, RevolveNode } from './nodes/surface'
import { RotateNode, ScaleNode, MirrorNode } from './nodes/transform'
import { ListItemNode, ListLengthNode, CullPatternNode, RepeatDataNode } from './nodes/sets'
import { FlattenTreeNode, GraftTreeNode, SimplifyTreeNode, CrossReferenceNode, LongestListNode, ShortestListNode, TreeStatsNode } from './nodes/tree'
import { PanelNode } from './nodes/panel'
import { PythonScriptNode } from './nodes/python'
import { FormulaCellNode } from './nodes/formula'
import { BookAssemblerNode, BookSectionNode, FieldTableNode, ReportNode } from './nodes/report'
import { DictionaryLookupNode, TableLookupNode, CoolPropNode, PlatformReturnNode, ProjectContextNode, DevAssistantBridgeNode } from './nodes/resources'
import {
  BernoulliNode, ContinuityNode, ReynoldsNumberNode, DarcyWeisbachNode,
  TorricelliNode, PoiseuilleNode, ArchimedesNode, FrictionFactorNode, PipeAreaNode,
  VelocityNode, LocalResistanceNode, PumpPowerNode, NPSHNode, TotalHeadNode,
} from './nodes/fluid'
import type { GHNode } from './nodes/base'
import { getNodeHelp } from './helpDocs'

export type NodeCategory = {
  name: string
  items: { label: string; factory: () => GHNode; help?: string }[]
}

function withHelp(factory: () => GHNode, label: string): () => GHNode {
  return () => {
    const node = factory()
    node.helpMarkdown = getNodeHelp(label)
    return node
  }
}

export const nodeCategories: NodeCategory[] = [
  {
    name: 'Params',
    items: [
      { label: 'Number', factory: withHelp(() => new NumberNode(), 'Number') },
      { label: 'Field Input', factory: withHelp(() => new FieldInputNode(), 'Field Input') },
      { label: 'Slider', factory: withHelp(() => new SliderNode(), 'Slider') },
      { label: 'Integer', factory: withHelp(() => new IntegerNode(), 'Integer') },
      { label: 'Boolean', factory: withHelp(() => new BooleanNode(), 'Boolean') },
      { label: 'Domain', factory: withHelp(() => new DomainNode(), 'Domain') },
      { label: 'Panel', factory: withHelp(() => new PanelNode(), 'Panel') },
      { label: 'Python Script', factory: withHelp(() => new PythonScriptNode(), 'Python Script') },
      { label: 'Toggle', factory: withHelp(() => new ToggleNode(), 'Toggle') },
      { label: 'Colour', factory: withHelp(() => new ColourNode(), 'Colour') },
      { label: 'Value List', factory: withHelp(() => new ValueListNode(), 'Value List') },
      { label: 'Domain Slider', factory: withHelp(() => new DomainSliderNode(), 'Domain Slider') },
      { label: 'Button', factory: withHelp(() => new ButtonNode(), 'Button') },
      { label: 'Report', factory: withHelp(() => new ReportNode(), 'Report') },
      { label: 'Book Section', factory: withHelp(() => new BookSectionNode(), 'Book Section') },
      { label: 'Field Table', factory: withHelp(() => new FieldTableNode(), 'Field Table') },
      { label: 'Book Assembler', factory: withHelp(() => new BookAssemblerNode(), 'Book Assembler') },
    ],
  },
  {
    name: 'Book',
    items: [
      { label: 'Report', factory: withHelp(() => new ReportNode(), 'Report') },
      { label: 'Book Section', factory: withHelp(() => new BookSectionNode(), 'Book Section') },
      { label: 'Field Table', factory: withHelp(() => new FieldTableNode(), 'Field Table') },
      { label: 'Book Assembler', factory: withHelp(() => new BookAssemblerNode(), 'Book Assembler') },
    ],
  },
  {
    name: 'Math',
    items: [
      { label: 'Addition', factory: withHelp(() => new AdditionNode(), 'Addition') },
      { label: 'Subtraction', factory: withHelp(() => new SubtractionNode(), 'Subtraction') },
      { label: 'Multiplication', factory: withHelp(() => new MultiplicationNode(), 'Multiplication') },
      { label: 'Division', factory: withHelp(() => new DivisionNode(), 'Division') },
      { label: 'Negative', factory: withHelp(() => new NegativeNode(), 'Negative') },
      { label: 'Power', factory: withHelp(() => new PowerNode(), 'Power') },
      { label: 'Formula Cell', factory: withHelp(() => new FormulaCellNode(), 'Formula Cell') },
      { label: 'Absolute', factory: withHelp(() => new AbsoluteNode(), 'Absolute') },
      { label: 'Integer Division', factory: withHelp(() => new IntegerDivisionNode(), 'Integer Division') },
      { label: 'Factorial', factory: withHelp(() => new FactorialNode(), 'Factorial') },
      { label: 'Modulus', factory: withHelp(() => new ModulusNode(), 'Modulus') },
      { label: 'Sine', factory: withHelp(() => new SineNode(), 'Sine') },
      { label: 'Cosine', factory: withHelp(() => new CosineNode(), 'Cosine') },
      { label: 'Tangent', factory: withHelp(() => new TangentNode(), 'Tangent') },
      { label: 'Floor', factory: withHelp(() => new FloorNode(), 'Floor') },
      { label: 'Ceiling', factory: withHelp(() => new CeilingNode(), 'Ceiling') },
      { label: 'Round', factory: withHelp(() => new RoundNode(), 'Round') },
      { label: 'Maximum', factory: withHelp(() => new MaximumNode(), 'Maximum') },
      { label: 'Minimum', factory: withHelp(() => new MinimumNode(), 'Minimum') },
      { label: 'Average', factory: withHelp(() => new AverageNode(), 'Average') },
      { label: 'Mass Addition', factory: withHelp(() => new MassAdditionNode(), 'Mass Addition') },
      { label: 'Mass Multiplication', factory: withHelp(() => new MassMultiplicationNode(), 'Mass Multiplication') },
      { label: 'Relative Differences', factory: withHelp(() => new RelativeDifferencesNode(), 'Relative Differences') },
      { label: 'Larger Than', factory: withHelp(() => new LargerThanNode(), 'Larger Than') },
      { label: 'Smaller Than', factory: withHelp(() => new SmallerThanNode(), 'Smaller Than') },
      { label: 'Equality', factory: withHelp(() => new EqualityNode(), 'Equality') },
      { label: 'Similarity', factory: withHelp(() => new SimilarityNode(), 'Similarity') },
      { label: 'Gate And', factory: withHelp(() => new GateAndNode(), 'Gate And') },
      { label: 'Gate Or', factory: withHelp(() => new GateOrNode(), 'Gate Or') },
      { label: 'Gate Not', factory: withHelp(() => new GateNotNode(), 'Gate Not') },
      { label: 'Gate Xor', factory: withHelp(() => new GateXorNode(), 'Gate Xor') },
      { label: 'Gate Majority', factory: withHelp(() => new GateMajorityNode(), 'Gate Majority') },
      { label: 'Gate Nand', factory: withHelp(() => new GateNandNode(), 'Gate Nand') },
      { label: 'Gate Nor', factory: withHelp(() => new GateNorNode(), 'Gate Nor') },
      { label: 'Gate Xnor', factory: withHelp(() => new GateXnorNode(), 'Gate Xnor') },
      { label: 'Remap', factory: withHelp(() => new RemapNode(), 'Remap') },
      { label: 'Expression', factory: withHelp(() => new ExpressionNode(), 'Expression') },
    ],
  },
  {
    name: 'Fluid',
    items: [
      { label: 'Bernoulli', factory: withHelp(() => new BernoulliNode(), 'Bernoulli') },
      { label: 'Continuity', factory: withHelp(() => new ContinuityNode(), 'Continuity') },
      { label: 'Reynolds', factory: withHelp(() => new ReynoldsNumberNode(), 'Reynolds') },
      { label: 'Velocity', factory: withHelp(() => new VelocityNode(), 'Velocity') },
      { label: 'Darcy-Weisbach', factory: withHelp(() => new DarcyWeisbachNode(), 'Darcy-Weisbach') },
      { label: 'Local Resistance', factory: withHelp(() => new LocalResistanceNode(), 'Local Resistance') },
      { label: 'Friction Factor', factory: withHelp(() => new FrictionFactorNode(), 'Friction Factor') },
      { label: 'Pipe Area', factory: withHelp(() => new PipeAreaNode(), 'Pipe Area') },
      { label: 'Total Head', factory: withHelp(() => new TotalHeadNode(), 'Total Head') },
      { label: 'Pump Power', factory: withHelp(() => new PumpPowerNode(), 'Pump Power') },
      { label: 'NPSH', factory: withHelp(() => new NPSHNode(), 'NPSH') },
      { label: 'Torricelli', factory: withHelp(() => new TorricelliNode(), 'Torricelli') },
      { label: 'Poiseuille', factory: withHelp(() => new PoiseuilleNode(), 'Poiseuille') },
      { label: 'Archimedes', factory: withHelp(() => new ArchimedesNode(), 'Archimedes') },
    ],
  },
  {
    name: 'Resources',
    items: [
      { label: 'Dictionary Lookup', factory: withHelp(() => new DictionaryLookupNode(), 'Dictionary Lookup') },
      { label: 'Table Lookup', factory: withHelp(() => new TableLookupNode(), 'Table Lookup') },
      { label: 'CoolProp Props', factory: withHelp(() => new CoolPropNode(), 'CoolProp Props') },
      { label: 'Project Context', factory: withHelp(() => new ProjectContextNode(), 'Project Context') },
      { label: 'Platform Return', factory: withHelp(() => new PlatformReturnNode(), 'Platform Return') },
      { label: 'AI Dev Bridge', factory: withHelp(() => new DevAssistantBridgeNode(), 'AI Dev Bridge') },
    ],
  },
  {
    name: 'Vector',
    items: [
      { label: 'Point', factory: withHelp(() => new PointNode(), 'Point') },
      { label: 'Vector XYZ', factory: withHelp(() => new VectorNode(), 'Vector XYZ') },
      { label: 'Deconstruct Point', factory: withHelp(() => new DeconstructPointNode(), 'Deconstruct Point') },
      { label: 'Distance', factory: withHelp(() => new DistanceNode(), 'Distance') },
      { label: 'Unit Vector', factory: withHelp(() => new UnitVectorNode(), 'Unit Vector') },
      { label: 'Vector Length', factory: withHelp(() => new VectorLengthNode(), 'Vector Length') },
      { label: 'Cross Product', factory: withHelp(() => new CrossProductNode(), 'Cross Product') },
      { label: 'Dot Product', factory: withHelp(() => new DotProductNode(), 'Dot Product') },
      { label: 'Move', factory: withHelp(() => new MoveNode(), 'Move') },
    ],
  },
  {
    name: 'Curve',
    items: [
      { label: 'Line', factory: withHelp(() => new LineNode(), 'Line') },
      { label: 'Line SDL', factory: withHelp(() => new LineSDLNode(), 'Line SDL') },
      { label: 'Circle', factory: withHelp(() => new CircleNode(), 'Circle') },
      { label: 'Arc', factory: withHelp(() => new ArcNode(), 'Arc') },
      { label: 'PolyLine', factory: withHelp(() => new PolyLineNode(), 'PolyLine') },
      { label: 'Divide Curve', factory: withHelp(() => new DivideCurveNode(), 'Divide Curve') },
      { label: 'Explode', factory: withHelp(() => new ExplodeNode(), 'Explode') },
    ],
  },
  {
    name: 'Surface',
    items: [
      { label: 'Plane', factory: withHelp(() => new PlaneNode(), 'Plane') },
      { label: 'Plane Origin', factory: withHelp(() => new PlaneOriginNode(), 'Plane Origin') },
      { label: 'Extrude', factory: withHelp(() => new ExtrudeNode(), 'Extrude') },
      { label: 'Revolve', factory: withHelp(() => new RevolveNode(), 'Revolve') },
    ],
  },
  {
    name: 'Transform',
    items: [
      { label: 'Rotate', factory: withHelp(() => new RotateNode(), 'Rotate') },
      { label: 'Scale', factory: withHelp(() => new ScaleNode(), 'Scale') },
      { label: 'Mirror', factory: withHelp(() => new MirrorNode(), 'Mirror') },
    ],
  },
  {
    name: 'Sets',
    items: [
      { label: 'Range', factory: withHelp(() => new RangeNode(), 'Range') },
      { label: 'Series', factory: withHelp(() => new SeriesNode(), 'Series') },
      { label: 'List Item', factory: withHelp(() => new ListItemNode(), 'List Item') },
      { label: 'List Length', factory: withHelp(() => new ListLengthNode(), 'List Length') },
      { label: 'Cull Pattern', factory: withHelp(() => new CullPatternNode(), 'Cull Pattern') },
      { label: 'Repeat Data', factory: withHelp(() => new RepeatDataNode(), 'Repeat Data') },
      { label: 'Flatten Tree', factory: withHelp(() => new FlattenTreeNode(), 'Flatten Tree') },
      { label: 'Graft Tree', factory: withHelp(() => new GraftTreeNode(), 'Graft Tree') },
      { label: 'Simplify Tree', factory: withHelp(() => new SimplifyTreeNode(), 'Simplify Tree') },
      { label: 'Cross Reference', factory: withHelp(() => new CrossReferenceNode(), 'Cross Reference') },
      { label: 'Longest List', factory: withHelp(() => new LongestListNode(), 'Longest List') },
      { label: 'Shortest List', factory: withHelp(() => new ShortestListNode(), 'Shortest List') },
      { label: 'Tree Stats', factory: withHelp(() => new TreeStatsNode(), 'Tree Stats') },
    ],
  },
]

# OpenOrd: Eine Open-Source-Toolbox für große Graphenlayouts

**Shawn Martin¹, W. Michael Brown², Richard Klavans³ und Kevin W. Boyack³**

¹Sandia National Laboratories, PO Box 5800, Albuquerque, NM 87185  
²Oak Ridge National Laboratories, 1 Bethel Valley Rd, Oak Ridge, TN 37831  
³SciTech Strategies, Inc., 2405 White Horse Rd, Berwyn, PA, 19132

## ZUSAMMENFASSUNG

Wir dokumentieren eine Open-Source-Toolbox zum Zeichnen großer ungerichteter Graphen. Diese Toolbox basiert auf einem zuvor implementierten Closed-Source-Algorithmus namens VxOrd. Unsere Toolbox, die wir OpenOrd nennen, erweitert die Fähigkeiten von VxOrd für große Graphenlayouts durch die Einbeziehung von Kantenschneiden, einem mehrstufigen Ansatz, Average-Link-Clustering und einer parallelen Implementierung. Auf jeder Ebene werden Knoten mittels kraftgerichteten Layouts und Average-Link-Clustering gruppiert. Die gruppierten Knoten werden dann neu gezeichnet und der Prozess wird wiederholt. Wenn eine geeignete Zeichnung des vergröberten Graphen erreicht ist, wird der Algorithmus umgekehrt, um eine Zeichnung des ursprünglichen Graphen zu erhalten. Dieser Ansatz führt zu Layouts großer Graphen, die sowohl lokale als auch globale Strukturen einbeziehen. Eine detaillierte Beschreibung des Algorithmus wird in diesem Paper gegeben. Beispiele mit Datensätzen von über 600.000 Knoten werden gezeigt. Der Code ist verfügbar unter www.cs.sandia.gov/~smartin.

**Schlüsselwörter:** Mehrstufig, Kraftgerichtet, Parallel, Großes Graphenlayout

## 1. EINLEITUNG

Graphenzeichnen wird verwendet, um relationale Daten zu visualisieren, typischerweise in zwei Dimensionen. Einige Anwendungen des Graphenzeichnens umfassen die Analyse sozialer Netzwerke, die Analyse wissenschaftlicher Literatur, Kartografie und Bioinformatik. Es gibt eine Vielzahl von Algorithmen für das Graphenzeichnen, von denen jeder einen anderen Satz ästhetischer Kriterien optimiert. Einige Beispiele für ästhetische Kriterien sind die Minimierung der Anzahl von Kantenkreuzungen, die Minimierung der Gesamtkantenlänge und die Maximierung der Trennung zwischen Knoten. Für ungerichtete Graphen, die mit geraden Kanten gezeichnet werden, ist einer der am häufigsten verwendeten Algorithmen das kraftgerichtete Layout.

In diesem Paper dokumentieren wir einen Graphenzeichnungsalgorithmus, der speziell für das Zeichnen großer realer Graphen entwickelt wurde. Unser Algorithmus verwendet Kantenschneiden, Average-Link-Clustering, mehrstufige Graphenvergröberung und eine parallele Implementierung einer kraftgerichteten Methode, die auf simuliertem Annealing basiert. Verwandte Algorithmen für kraftgerichtetes Layout existieren, einschließlich Algorithmen mit einem mehrstufigen Ansatz, Algorithmen mit Knotenclustering und Algorithmen, die mit einer parallelen GPU-Architektur implementiert sind. Unser Algorithmus ist jedoch der einzige verfügbare, der alle drei dieser Ideen kombiniert: einen mehrstufigen Ansatz, Knotenclustering und eine parallele Implementierung (wobei unsere Parallelität auf Clustern basiert, nicht auf GPUs). Darüber hinaus führen wir eine Heuristik für das Kantenschneiden ein, die dazu dient, die Visualisierung von Graphen zu ermöglichen, die möglicherweise keine wünschenswerte Gradverteilung aufweisen (häufig in realen Graphen zu finden).

Unser Algorithmus basiert auf einem früheren kraftgerichteten Algorithmus namens VxOrd. Diese neue Version, OpenOrd, wird auf den folgenden Seiten beschrieben. In Abschnitt 2 geben wir die Motivation für unsere Modifikationen von VxOrd an. In Abschnitt 3 beschreiben wir die verschiedenen Teile unseres Algorithmus, einschließlich kraftgerichtetem Layout, parallelem Layout, rekursiver Graphenvergröberung und Average-Link-Clustering. In Abschnitt 4 demonstrieren wir einige der Eigenschaften unseres Algorithmus anhand von Anwendungen auf mehrere reale Datensätze, einschließlich eines Wikipedia-Artikel-Datensatzes mit 659.000 Knoten. Schließlich geben wir in Abschnitt 5 unsere Schlussfolgerungen. Der Code für OpenOrd ist verfügbar unter http://www.cs.sandia.gov/~smartin.

## 2. MOTIVATION

OpenOrd ist ein kraftgerichteter Layout-Algorithmus, der speziell für die Verarbeitung sehr großer Graphen entwickelt wurde, wie sie beispielsweise bei wissenschaftlichen Literaturzitationsanalysen auftreten. Er basiert auf einer Implementierung des Frutcherman-Reingold-Algorithmus, bekannt als VxOrd, der zuvor in wissenschaftlichen Zitationsanalysen und bei der Analyse von Bioinformatikdaten verwendet wurde. OpenOrd stellt unsere Bemühung dar, VxOrd auf sehr große Graphen (mehr als 100.000 Knoten) zu skalieren.

Wir haben drei Probleme identifiziert, die mit der Skalierung des VxOrd-kraftgerichteten Layout-Algorithmus auf große Graphen verbunden sind, die wir in diesem Abschnitt als unsere Motivation für den nachfolgenden Algorithmus in Abschnitt 3 beschreiben. 

Erstens nimmt die Fähigkeit des Algorithmus, die globale Struktur des Layouts korrekt aufzudecken, mit der Größe des Graphen ab. Dieser Effekt variiert zweifellos abhängig von der Gradverteilung der Knoten, ist aber selbst bei relativ einfachen gitterartigen Graphen offensichtlich. Um dieses Phänomen zu veranschaulichen, verwendeten wir den Swiss-Roll-Datensatz, der ursprünglich im Bereich der nichtlinearen Dimensionsreduktion eingeführt wurde. Dieser Datensatz wurde entwickelt, um die Unzulänglichkeiten linearer Methoden zur Dimensionsreduktion zu demonstrieren (da lineare Methoden die Swiss Roll nicht ohne Fehler projizieren können). In unserem Fall verwenden wir diesen Datensatz nur als Beispiel – unser Algorithmus ist für Graphenzeichnen, nicht für Dimensionsreduktion. Wir haben einem Graphen aus 20.000 Punkten, die von der Swiss-Roll-Mannigfaltigkeit mit 20 nächsten Nachbarn abgetastet wurden, eine Graphstruktur auferlegt und den Graphen mit VxOrd gezeichnet. Die Unfähigkeit des kraftgerichteten Layouts, die globale Struktur korrekt aufzudecken, wurde auch in früheren Arbeiten festgestellt, wo gezeigt wurde, dass ein mehrstufiger Ansatz verwendet werden kann, um den Effekt zu mildern. Daher beinhalten wir eine mehrstufige Strategie in OpenOrd.

Zweitens haben wir festgestellt, dass die Verwendung von kraftgerichtetem Layout bei großen realen Graphen oft zu visuell unattraktiven Layouts führt. Oft sind diese Graphen spärlich, aber dennoch gut verbunden (d.h. nicht skalenfrei), sodass die resultierende Zeichnung vollständig verbunden aussieht. Ein Beispiel mit einem Graphen mit 6.147 Knoten und 61.646 Kanten, der auf Hefe-Mikroarray-Daten auferlegt wurde, ist in Abbildung 2(a) dargestellt. Obwohl der Graph nur 61.646 Kanten hat (0,3% der möglichen Anzahl), sieht er vollständig verbunden aus. Um visuell ansprechendere Layouts zu fördern, verwenden wir eine Kantenschneidestrategie, um das Clustering der Knoten zu fördern. Dies kann als Kompromiss zwischen den beiden konkurrierenden Kräften im kraftgerichteten Layout gesehen werden und wird in Abschnitt 3.1 beschrieben.

Schließlich hat der Frutcherman-Reingold-Ansatz für kraftgerichtetes Layout eine hohe Laufzeit (in der Größenordnung von O(n²) bei der Anzahl der Knoten n). Dies ist natürlich eine große Einschränkung bei der Anwendung von kraftgerichtetem Layout auf große Graphen. Die Laufzeit kann durch eine gitterbasierte Dichteberechnung und durch die Verwendung eines mehrstufigen Ansatzes verbessert werden. Wir implementieren beide Optionen und fügen auch eine Option zur Verwendung paralleler Berechnung in OpenOrd hinzu.

## 3. ALGORITHMUS

Wie in Abschnitt 2 erwähnt, basiert OpenOrd auf dem Frutcherman-Reingold-Algorithmus für kraftgerichtetes Layout, der zuvor als VxOrd implementiert wurde. Um den Hintergrund zu liefern, beschreiben wir diesen Algorithmus hier, wobei Modifikationen in den folgenden Unterabschnitten beschrieben werden.

Angenommen, wir haben einen ungerichteten gewichteten Graphen G = (V,E), wobei die Knoten durch V = {v₁,...,vₙ} und die Kanten durch E = {eᵢⱼ} gegeben sind. Sei W = (wᵢⱼ) die Adjazenzmatrix, die dem Graphen G entspricht, sodass Kante eᵢⱼ das Gewicht wᵢⱼ hat. Da der Graph ungerichtet ist, wissen wir, dass wᵢⱼ = wⱼᵢ, sodass W symmetrisch ist.

Das Ziel von OpenOrd ist es, G in zwei Dimensionen zu zeichnen. Sei xᵢ = (xᵢ,₁, xᵢ,₂) die Position von vᵢ in der Ebene. OpenOrd zeichnet G, indem versucht wird, zu lösen:

min[x₁,...,xₙ] ∑ᵢ (∑ⱼ wᵢⱼd(xᵢ,xⱼ)² + Dxᵢ)

wobei Dxᵢ die Dichte der Punkte x₁,...,xₙ in der Nähe von xᵢ bezeichnet. Die Summe in (1) enthält sowohl einen anziehenden als auch einen abstoßenden Term. Der anziehende Term ∑ⱼ(wᵢⱼd(xᵢ,xⱼ)²) versucht, Knoten zusammenzuziehen, die über wᵢⱼ starke Beziehungen haben. Der abstoßende Term Dxᵢ versucht, Knoten in Bereiche der Ebene zu schieben, die dünn besiedelt sind.

Die Minimierung in (1) ist ein schwieriges nichtlineares Problem. Aus diesem Grund verwenden wir ein gieriges Optimierungsverfahren, das auf simuliertem Annealing basiert. Unser Verfahren ist insofern gierig, als wir die Position jedes Knotens aktualisieren, indem wir die innere Summe ∑ⱼ(wᵢⱼd(xᵢ,xⱼ)²) + Dxᵢ optimieren, während wir die Positionen der anderen Knoten fixieren. Alle Knoten werden zunächst am Ursprung platziert, und die Aktualisierung wird für jeden Knoten im Graphen wiederholt, um eine Iteration der Optimierung abzuschließen. Die Iterationen werden über einen Zeitplan vom Typ des simulierten Annealings gesteuert, der aus fünf verschiedenen Phasen besteht: flüssig, Expansion, Abkühlung, Verdichtung und Köcheln.

Während jeder Phase des Annealing-Zeitplans variieren wir mehrere Parameter der Optimierung: Temperatur, Anziehung und Dämpfung. Diese Parameter steuern, wie weit Knoten sich bewegen dürfen. Bei jedem Schritt des Algorithmus berechnen wir zwei mögliche Knotenverschiebungen. Die erste mögliche Bewegung ist immer ein zufälliger Sprung, dessen Entfernung durch die Temperatur bestimmt wird. Die zweite mögliche Bewegung wird analytisch berechnet (bekannt als Barrierensprung). Diese Bewegung wird als gewichteter Schwerpunkt der Nachbarn des Knotens berechnet. Der Dämpfungsmultiplikator bestimmt, wie weit zum Schwerpunkt hin der Knoten sich bewegen darf, und der Anziehungsfaktor gewichtet die resultierende Energie, um die Wünschbarkeit einer solchen Bewegung zu bestimmen. Von diesen beiden möglichen Bewegungen wählen wir die Bewegung, die zur niedrigsten inneren Summenenergie ∑ⱼ(wᵢⱼd(xᵢ,xⱼ)²) + Dxᵢ führt.

Der Annealing-Zeitplan wird dadurch bestimmt, wie viel Zeit in jeder Phase verbracht wird, und das Verhalten der Optimierung wird durch Anpassung der verschiedenen Parameter bestimmt. Der Standard-Zeitplan verbringt ungefähr 25% seiner Zeit in der flüssigen Phase, 25% in der Expansionsphase, 25% in der Abkühlungsphase, 10% in der Verdichtungsphase und 15% in der Köchelphase. Die flüssigen, Expansions- und Abkühlungsphasen verwenden alle dieselbe Temperatur, variieren jedoch den Anziehungsfaktor und den Dämpfungsmultiplikator. Die Verdichtungs- und Köchelphasen verwenden eine niedrigere Temperatur (ungefähr 1/4 der Temperatur, die während der flüssigen, Expansions- und Abkühlungsphasen verwendet wird) sowie niedrigere Anziehung und Dämpfung.

Schließlich verwenden wir eine gitterbasierte Methode zur Berechnung des Dichteterms Dxᵢ. Normalerweise wäre die Dichteberechnung O(n²), aber durch die Verwendung eines Gitters für die Dichteberechnung können wir die Kosten auf O(n) reduzieren, wobei die Speichernutzung entsprechend der Anzahl der Gitterboxen zunimmt, die wir in unserer Berechnung verwenden. Diese Vergröberung kann jedoch aufgrund der Tatsache, dass die Dichte diskontinuierlich entlang der Gitterlinien variiert, zu Ungenauigkeiten führen. Aus diesem Grund wird das Dichtegitter während der letzten Köchelphase nicht verwendet.

### 3.1 Kantenschneiden

Um visuell ansprechende Layouts zu erzeugen, haben wir eine Heuristik entwickelt, die dem Benutzer die Kontrolle über die Menge des Knotenclusterns und des Weißraums im Layout ermöglicht. Um das Knotenclustern zu steuern, beeinflusst unsere Heuristik die relative Bedeutung der beiden konkurrierenden Terme in der Zielfunktion in Gleichung (1). Um den Weißraum zu steuern, erlauben wir die Möglichkeit, bestimmte lange Kanten während der Optimierung der Zielfunktion zu ignorieren. Tatsächlich können sowohl Knotenclustern als auch Weißraum gleichzeitig gesteuert werden, indem die langen Kanten ignoriert oder geschnitten werden.

Wie zuvor erwähnt, dient der Term ∑ⱼ(wᵢⱼd(xᵢ,xⱼ)²) in der Zielfunktion aus Gleichung (1) dazu, Knoten mit großen Gewichtsverbindungen anzuziehen, während der Term Dxᵢ abstoßend ist und eine hohe durchschnittliche Knotendichte oder Cluster verhindert. Es ist die relative Bedeutung der beiden Terme, die den Grad des Clustering in einem Layout bestimmt. Wenn der anziehende Term dominiert, wird weniger Clustering erwartet; wenn der abstoßende Term dominiert, wird mehr Clustering auftreten. Das Schneiden langer Kanten während der Optimierung verringert den Wert des anziehenden Terms und erlaubt daher eine Erhöhung des Werts des abstoßenden Terms, wodurch die Kontrolle über das Knotenclustern im Layout ermöglicht wird.

Weißraum kann durch die Anzahl der langen Kanten gesteuert werden, die wir in unserer Berechnung verwenden. Kanten, die lang sind, aber ein großes Gewicht haben, können einen übermäßigen Einfluss auf entfernte Cluster ausüben, wodurch zwei Gruppen übereinander platziert werden, wenn ein ansprechenderes Layout erhalten werden könnte, wenn sie sich trennen dürften. Das Schneiden langer Kanten während der Optimierung ermöglicht es Clustern, sich zu trennen. Es verbessert auch die endgültige Zeichnung, da diese Kanten sich über das gesamte Layout erstrecken und daher die feinere Struktur in der Zeichnung verdecken.

Das Kantenschneiden in OpenOrd wird unter Verwendung einer Zahl von 0 bis 1 angegeben. Ein Kantenschneidewert von 0 entspricht dem Standard-Frutcherman-Reingold-Layout-Algorithmus (kein Schneiden), während ein Kantenschneidewert von 1 aggressivem Schneiden entspricht. Das Kantenschneiden ist während der Expansions- und Abkühlungsphasen des Annealing-Zeitplans erlaubt. Zu Beginn dieser beiden Phasen wird ein Schwellenwert als Prozentsatz der größten Entfernung zwischen zwei Knoten in der Zeichnung angegeben. Dieser Prozentsatz wird durch den Kantenschneideparameter gesteuert, wobei ein Wert von 0 100% der größten Entfernung entspricht und ein Wert von 1 0% der größten Entfernung entspricht. Das Kantenschneiden unterliegt der Einschränkung, dass jeder Knoten mindestens eine Kante haben muss. Während der Expansions- und Abkühlungsphasen wird eine Kante geschnitten, wenn ihre Entfernung größer als der Schwellenwert ist.

Der Kantenschneideparameter entspricht nicht dem Anteil der Kanten, die geschnitten werden. Abhängig vom Eingabegraphen kann der Kantenschneideparameter nur sehr geringe Auswirkungen haben, da ein Graph während der Optimierung möglicherweise keine langen Kanten aufweist (häufig bei Gittern der Fall). Für reale Graphen kann der Kantenschneideparameter jedoch einen großen Einfluss auf das Layout des endgültigen Graphen haben und wird in Abschnitt 4 untersucht.

### 3.2 Paralleles kraftgerichtetes Layout

OpenOrd kann sowohl auf seriellen als auch auf parallelen Computern ausgeführt werden. Die parallele Version ist der seriellen Version ähnlich. Beide verwenden dieselbe gierige Aktualisierung und folgen demselben Annealing-Zeitplan. In der parallelen Version werden die Aktualisierungen jedoch parallel statt sequentiell durchgeführt.

Der parallele kraftgerichtete Layout-Algorithmus in OpenOrd beginnt damit, dass jeder Prozessor eine zufällige nicht überlappende Teilmenge der Knoten des Graphen zugewiesen bekommt. Der Prozessor verfolgt seine zugewiesenen Knoten sowie alle benachbarten Knoten. Alle Prozessoren verfolgen die Positionen jedes Knotens, sodass jeder Prozessor eine identische Kopie des Dichtegitters aufrechterhalten kann.

Jeder Prozessor ist verantwortlich für die Verschiebung seiner zugewiesenen Knoten, um die Zielfunktion in Gleichung (1) zu optimieren. Da jeder Prozessor die Positionen der zugewiesenen Knoten sowie die Positionen benachbarter Knoten kennt, können die Knotenpositionen unter Verwendung desselben gierigen Verfahrens aktualisiert werden, das in der seriellen Version des Algorithmus verwendet wurde. Nach jeder Knotenaktualisierung werden Positionsinformationen zwischen den Prozessoren ausgetauscht und der Prozess wird bis zum Abschluss fortgesetzt.

Zusätzlich zur erhöhten Rechengeschwindigkeit hat die parallele Version von OpenOrd den Vorteil, dass sie einen sehr großen Graphen über viele Prozessoren verteilen kann und somit einen Computer mit einer enormen Menge an effektivem Speicher nutzt. Dies ist möglich, weil jeder gegebene Graph viel mehr Kanten als Knoten haben wird. Darüber hinaus sind die Ergebnisse sowohl der seriellen als auch der parallelen Version von OpenOrd ähnlich, da dasselbe gierige Aktualisierungsverfahren und derselbe simulierte Annealing-Zeitplan beibehalten werden. Die Leistung der beiden Algorithmen sowie Unterschiede in der Ausgabe werden in Abschnitt 4.2 diskutiert.

### 3.3 Mehrstufiges Graphenlayout

Die Verwendung von OpenOrd parallel ermöglicht das Layout sehr großer Graphen. Das Kantenschneiden verbessert die visuelle Attraktivität der Layouts. Die Layouts leiden jedoch immer noch unter dem Potenzial für eine falsche globale Struktur, wie in Abschnitt 2 anhand der Swiss Roll beschrieben. Um dieses Problem anzugehen, haben wir den mehrstufigen Ansatz von Walshaw an OpenOrd angepasst. Walshaws Verfahren läuft wie folgt ab. Zunächst wird eine Sequenz von Graphen G₀ = G, G₁,...,Gₗ unter Verwendung eines zufälligen Vergröberungsverfahrens erzeugt. Bei dem Vergröberungsverfahren werden benachbarte Knoten zufällig zusammengeführt, und ihre Kantengewichte werden addiert, wenn zwei Nachbarn einen weiteren gemeinsamen Nachbarn haben. Dieser Prozess wird wiederholt, bis ein ausreichend kleiner Graph Gₗ erhalten wird. Der Graph Gₗ wird mit einem kraftgerichteten Algorithmus gezeichnet. Die Knotenplatzierung in der Zeichnung von Gₗ wird als Ausgangspunkt für das Zeichnen des Graphen Gₗ₋₁ verwendet. Wenn beispielsweise die Knoten u und v in Gₗ₋₁ in w in Gₗ zusammengeführt wurden, werden u und v an der Position platziert, die zuvor von w in der Zeichnung von Gₗ belegt war. Der kraftgerichtete Algorithmus wird erneut angewendet, um eine Zeichnung von Gₗ₋₁ zu erhalten, und der Prozess wird wiederholt.

Walshaws Methode ist sehr schnell und funktioniert nachweislich gut bei großen Graphen. Wir verwenden Walshaws Ansatz mit einer zusätzlichen Verfeinerung. Anstelle eines zufälligen Vergröberungsverfahrens verwenden wir ein auf Clustering basierendes Vergröberungsverfahren (als nächstes beschrieben). Natürlich verwenden wir auch OpenOrd als kraftgerichtetes Layout. Ansonsten verwenden wir das im vorherigen Absatz skizzierte und von Walshaw ausführlicher beschriebene Verfahren.

Die Verwendung unseres kraftgerichteten Layout-Algorithmus erfordert zusätzliche Anpassungen, um den simulierten Annealing-Zeitplan zu berücksichtigen und die Verwendung von Kantenschneiden im mehrstufigen Ansatz zu ermöglichen. Nach Erhalt einer Sequenz von vergröberten Graphen G₀,...,Gₗ folgen wir Walshaw, indem wir ein Layout von Gₗ mit Standard-Kantenschneiden unter Verwendung des Standard-Annealing-Zeitplans erstellen. Während der Verfeinerung platzieren wir die Knoten wie bei Walshaw, verwenden erneut Standard-Kantenschneiden, modifizieren jedoch unseren Annealing-Zeitplan, um die flüssige Phase zu vermeiden und die Expansionsphase zu minimieren. Wir eliminieren auch die Köchelphase während der Verfeinerung. Das endgültige Layout wird unter Verwendung aggressiveren Kantenschneidens erstellt und schließt die Köchelphase ein. Überraschenderweise zeigen unsere Experimente, dass unsere mehrstufige Layout-Methode gut für Datensätze funktioniert, die in der Größe von 6.000 bis 850.000 Knoten reichen, selbst bei Verwendung derselben Annealing-Zeitplan-/Kantenschneideparameter. Durchgeführte Experimente und verwendete Datensätze werden in Abschnitt 4 beschrieben.

### 3.4 Average-Link-Clustering

In unserem mehrstufigen Layout-Algorithmus verwenden wir Average-Link-Clustering, um die vergröberten Graphen G₀ = G, G₁,...,Gₗ bereitzustellen. Unser Clustering-Algorithmus basiert auf einem agglomerativen Average-Link-Modell, bei dem wir sowohl Kantengewichte als auch Entfernungen verwenden, um Cluster bereitzustellen. Entfernungen werden aus einer Zeichnung durch unseren kraftgerichteten Layout-Algorithmus genommen. Sobald Cluster bestimmt sind, führen wir alle Knoten in einem gegebenen Cluster zusammen, um einen Knoten im neuen gröberen Graphen zu erhalten. Kanten werden gemäß der zuvor beschriebenen Methode zusammengeführt.

Bei der Beschreibung unserer Methode nehmen wir an, dass wir G₀ vergröbern, um G₁ zu erhalten. Das Erhalten der verbleibenden vergröberten Graphen erfolgt mit demselben Verfahren. Der erste Schritt in unserem Clustering-Algorithmus besteht darin, G₀ unter Verwendung maximalen Kantenschneidens mit unserem kraftgerichteten Layout-Algorithmus zu zeichnen. Dieser Schritt liefert uns eine Proxy-Darstellung, die verwendet werden kann, um Entfernungen zwischen Knoten zusätzlich zu den Kantengewichten, die G₀ definieren, bereitzustellen. Maximales Kantenschneiden ermutigt den Layout-Algorithmus, eine natürlich geclusterte Darstellung zu erzeugen (siehe Abschnitt 4.3 für ein Beispiel).

Als nächstes erzeugen wir einen neuen ungerichteten gewichteten Graphen G̃₀, dessen Kanten gemäß den Entfernungen in unserer Zeichnung von G₀ berechnet werden. Kanten in diesem Graphen umfassen alle Kanten, die nicht vom Layout-Algorithmus geschnitten wurden, zusammen mit den Kanten mit dem größten Gewicht für jeden Knoten in G₀. Wir fügen die Kanten mit dem größten Gewicht hinzu, um einen verbundenen Graphen sicherzustellen. Die Kantengewichte in G̃₀ sind nicht mehr die ursprünglichen Kantengewichte, die in G₀ bereitgestellt wurden; sie sind jetzt die Entfernungen zwischen verbundenen Knoten in G̃₀.

Unser abgeleiteter Graph G̃₀ kann in einem agglomerativen Clustering-Algorithmus verwendet werden. Der Algorithmus, den wir verwenden, ist eine Form des hierarchischen Average-Link-Clustering. In diesem Algorithmus wird jedem Knoten zunächst ein eindeutiger Cluster zugewiesen. Cluster werden dann mit benachbarten Clustern zusammengeführt, gemessen an der Entfernung zwischen Cluster-Schwerpunkten. Traditionell wird dieser Prozess wiederholt, bis alles in einem einzigen Cluster zusammengeführt wurde. In unserem Algorithmus geben wir jedoch einen Entfernungsschwellenwert an, nach dem wir die Bildung neuer Cluster einstellen. Der Entfernungsschwellenwert im Average-Link-Clustering kann vom Benutzer bereitgestellt werden.

Alternativ kann der Schwellenwert automatisch von OpenOrd ausgewählt werden. Die automatische Auswahl erfolgt durch Lokalisierung des Punktes auf der Darstellung von normalisiertem Rang vs. normalisierter Entfernung in G̃₀, an dem die Steigung 45° beträgt. Der Rang wird durch Sortieren der Kantenwerte in G̃₀ berechnet; der normalisierte Rang ist auf einen Bereich von 0 bis 1 normalisiert. Die Entfernung wird durch den tatsächlichen Kantenwert in G̃₀ angegeben; die normalisierte Entfernung ist auf einen Bereich von 0 bis 1 normalisiert. Für reale Datensätze haben wir festgestellt, dass die normalisierte Rang-vs.-Entfernungs-Kurve oft einen guten Grenzwert für das Average-Link-Clustering liefert, wenn die Steigung 45° beträgt (dieser Schwellenwert liegt oft zwischen 0,9 und 0,95 in Bezug auf den normalisierten Rang).

## 4. BEISPIELE

Wir haben OpenOrd an mehreren Datensätzen getestet. Wie in Abschnitt 2 erwähnt, haben wir ein Mikroarray-Genexpressions-Experiment verwendet, das in der Studie des Zellzyklus in Hefe generiert wurde. Dieser Datensatz wurde zuvor mit dem VxOrd-Vorgänger von OpenOrd getestet. Die Daten bestehen aus gleichzeitigen Messungen von 6.147 Genen über 18 Zeitpunkte. Eine Graphstruktur wurde den Daten auferlegt, indem für jedes Gen die 10 Gene mit der höchsten zeitlichen Korrelation genommen wurden. Dies erzeugte einen Graphen mit 6.147 Knoten und 61.646 Kanten. Wir verwenden den Hefe-Datensatz, um den Effekt des Kantenschneidens und die Verwendung paralleler Berechnung mit OpenOrd zu demonstrieren.

Wir haben auch eine Inkarnation des Swiss-Roll-Datensatzes verwendet, mit einer Stichprobe von 20.000 Punkten und einem Graphen, der unter Verwendung der 20 nächsten Nachbarn jedes Punktes auferlegt wurde. Wir verwendeten den Swiss-Roll-Datensatz, um die mehrstufigen Fähigkeiten von OpenOrd zu untersuchen. Darüber hinaus haben wir einen großen Datensatz von der Wikimedia Foundation verwendet, um die mehrstufigen Fähigkeiten weiter zu testen. Dieser Datensatz wurde von B. Herr et al. unter Verwendung von Wikipedia-Artikeln aus dem Jahr 2007 gesammelt und verarbeitet (siehe http://scimaps.org/maps/wikipedia). Der Datensatz besteht aus 659.388 Wikipedia-Artikeln, die durch 16.582.426 Hyperlinks verbunden sind.

Schließlich haben wir Parametertests in OpenOrd an vielen zusätzlichen Datensätzen durchgeführt. Diese Datensätze umfassen 8.712 Zeitschriften aus dem Jahr 2003 von Thomson Scientific Institute of Scientific Information (ISI) Journal Citation Reports, verbunden mit 98.705 Kanten; einen 32.776 Dokument-Datensatz mit Fokus auf Festkörperbeleuchtung aus ISI über die letzten 25 Jahre, verbunden durch 222.626 Co-Zitations-Ähnlichkeiten; einen 218.716 Artikel-Datensatz aus dem ersten Quartal des Jahres 2003 in der ISI-Datenbank, verbunden durch 1.821.976 Co-Zitations-Ähnlichkeiten; und schließlich einen 849.888 Artikel-Datensatz aus dem Jahr 2004 in der ISI-Datenbank, verbunden durch 5.843.729 Co-Zitations-Ähnlichkeiten. Wir verwendeten diese Datensätze, um die Auswirkungen der verschiedenen Parameter auf unterschiedliche Größen und Arten von Daten zu untersuchen.

### 4.1 Kantenschneiden

Das Kantenschneiden in OpenOrd wird unter Verwendung einer Zahl von 0 bis 1 angegeben. Ein Kantenschneidewert von 0 entspricht dem Standard-Frutcherman-Reingold-Layout-Algorithmus (kein Schneiden), während ein Kantenschneidewert von 1 aggressivem Schneiden entspricht. Aggressives Schneiden fördert Clustering, schneidet aber nicht jede Kante. Der Standardwert für Kantenschneiden in OpenOrd ist 0,8. Wir demonstrieren die Effekte des Kantenschneidens auf das Layout von Spellmans Hefe-Daten in Abbildung 2.

Um die Grafik in Abbildung 2(d) zu erstellen, haben wir den gesamten anziehenden Term ∑ᵢ,ⱼ(wᵢⱼd(xᵢ,xⱼ)²) und den gesamten abstoßenden Term ∑ᵢ Dxᵢ für 11 Layouts der Hefe-Daten berechnet, wobei Kantenschneideparameterwerte von 0, 0,1,..., 0,9, 1 verwendet wurden. Die Grafiken vergleichen die anziehenden und abstoßenden Terme, normalisiert auf einen Bereich zwischen 0 und 1. Wie in Abschnitt 3.1 diskutiert, nimmt der anziehende Term ab, wenn Kanten geschnitten werden, was somit eine Erhöhung des abstoßenden Terms ermöglicht und daher Clustering fördert. Wie auch in Abschnitt 3.1 diskutiert wurde, bietet das Schneiden der langen Kanten zusätzlichen Weißraum in den Zeichnungen. Diese Effekte sind in Abbildung 2(a-c) offensichtlich.

### 4.2 Seriell vs. Parallel

OpenOrd kann entweder im seriellen oder im parallelen Modus ausgeführt werden. Der Algorithmus ist in beiden Fällen derselbe, aber die Ergebnisse im parallelen Modus sind nicht garantiert identisch mit den Ergebnissen im seriellen Modus. Daher war unser erster Test von OpenOrd im parallelen Modus die Bewertung des potenziellen Unterschieds zwischen den beiden Modi. Für diesen Test verwendeten wir erneut Spellmans Hefe-Daten. Wir führten OpenOrd auf den Hefe-Daten mit 1, 2, 4, 8, 16 und 32 Prozessoren aus. Der Fall mit 1 Prozessor ist die serielle Version.

Wir verglichen die Ausgaben jedes Laufs, indem wir eine Ähnlichkeitsmetrik sε(U,V) ∈ [0,1] berechneten, wobei U, V zwei Layouts desselben m-Knoten-Datensatzes {x₁,...,xₘ} sind. Die Metrik wird berechnet, indem zunächst Nachbarschaftsinzidenzmatrizen NU,ε und NV,ε konstruiert werden, wobei N•,ε eine m×m-Matrix N•,ε = (nᵢⱼ) ist, mit

nᵢⱼ = 1 wenn ||xᵢ - xⱼ|| < ε, sonst 0

Nun ist

sε(U,V) = (NU,ε · NV,ε) / (||NU,ε|| ||NV,ε||)

wobei NU,ε · NV,ε das Skalarprodukt von NU,ε und NV,ε ist, wenn beide Matrizen als Vektoren der Länge m² betrachtet werden. Diese Metrik ist zwischen 0 und 1 begrenzt, wobei größere Werte eine größere Ähnlichkeit anzeigen. Es handelt sich um eine Modifikation einer zuvor vorgeschlagenen Ähnlichkeitsmetrik.

Für unsere Berechnungen skalierten wir jedes Layout U und V so, dass es im Bereich [0,1] × [0,1] liegt, und verwendeten ε = 0,1. Wir erhielten eine durchschnittliche Ähnlichkeit von 0,72 für die parallelen Layouts mit dem seriellen Layout. Die durchschnittliche Nachbarschaftsgröße betrug 24 Knoten. Zusätzlich zu dieser Metrik verglichen wir die Ausgaben jedes Laufs qualitativ, wie in Abbildung 3(a-f) gezeigt. Unsere Metrikberechnungen zeigen, dass die lokale Struktur des Layouts während der parallelen Berechnungen erhalten bleibt, und die qualitativen Ergebnisse zeigen, dass auch die globale Struktur erhalten bleibt. Zusätzlich zur Bereitstellung ähnlicher Ergebnisse bietet die parallele Version von OpenOrd auch eine rechnerische Beschleunigung, wie in Abbildung 3(g) gezeigt.

### 4.3 Mehrstufiges Layout

Wie zuvor diskutiert, skaliert der Frutcherman-Reingold-Algorithmus nicht gut auf sehr große Graphen. Zusätzlich zur hohen Laufzeit verwirrt der Algorithmus oft die globale Struktur der Eingabe, wie anhand der Swiss-Roll-Daten in Abbildung 1(a,b) demonstriert. Bei den Swiss-Roll-Daten ist die Zeichnung auf lokaler Ebene korrekt, aber auf globaler Ebene verwickelt. Um bessere Ergebnisse zu erzielen, verwendet OpenOrd mehrstufige Graphenvergröberung, mit verschiedenen Modifikationen, wie in Abschnitt 3.3 beschrieben.

Wir demonstrieren zunächst unsere Ergebnisse unter Verwendung der Vergröberung, indem wir den Swiss-Roll-Datensatz erneut betrachten. Unter Verwendung von Vergröberung mit 9 Ebenen und ohne Kantenschneiden erhielten wir das global korrekte Layout der Swiss Roll, das in Abbildung 1(c) gezeigt wird.

Als Nächstes demonstrieren wir die Ergebnisse des mehrstufigen Ansatzes, indem wir ein Layout von 659.388 Wikipedia-Artikeln aus dem Jahr 2007 erstellen. Dieses Layout wurde unter Verwendung von 6 Rekursionsebenen berechnet und ist in Abbildung 4 dargestellt. Der Ansatz verwendet aggressives Kantenschneiden und Clustering während der Vergröberung, gefolgt von wiederholten Anwendungen des Standard-OpenOrd-Layout-Algorithmus während der Verfeinerung. Ohne Vergröberung zeichnet OpenOrd denselben Graphen als gleichmäßig dichte, hochgradig verbundene und visuell unattraktive Kugel.

### 4.4 Parametertests

Der in OpenOrd verwendete Layout-Algorithmus hat eine Vielzahl von Parametern, die das Verhalten des resultierenden Layouts steuern, einschließlich zufälligem Startwert, simuliertem Annealing-Optimierungszeitplan und dem Kantenschneideparameter. Bei Verwendung des Layout-Algorithmus im mehrstufigen Modus müssen wir diese Parameter entsprechend der aktuellen Phase der Vergröberung oder Verfeinerung anpassen, damit die Layout-Kontinuität beim Fortschreiten erhalten bleibt. In diesem Abschnitt testen wir unsere Parameterauswahl anhand einer Vielzahl von Datensätzen.

Die Ergebnisse unserer Benchmarking-Bemühungen sind in Tabelle 1 dargestellt. Trotz der Vielfalt der Datensätze stellten wir fest, dass ein gemeinsamer Satz von Parametern gute Layouts unter Verwendung des mehrstufigen Modus lieferte. Diese Parameter werden als Standardwerte im Code unter www.cs.sandia.gov/~smartin bereitgestellt. Die Datensätze, ihre Größen und die verwendete Rekursionsebene sind alle in Tabelle 1 dargestellt. Laufzeiten werden ebenfalls bereitgestellt, um dem Benutzer eine Vorstellung vom Aufwand zu geben, der für eine gegebene Datensatzgröße erforderlich ist. Die Zeiten wurden auf einer 3,4 GHz Intel Xeon Workstation mit 4 GB RAM ermittelt.

**Tabelle 1: Parametertests**

| Datensatz | Knoten | Kanten | Ebene | Zeit |
|-----------|--------|---------|-------|------|
| Hefe | 6.147 | 61.646 | 3 | 1:29 |
| Zeitschriften | 8.712 | 98.705 | 3 | 2:13 |
| Swiss Roll | 20.000 | 400.000 | 9 | 4:01 |
| Festkörperbeleuchtung | 32.776 | 222.626 | 4 | 7:16 |
| Quartal ISI 2003 | 218.716 | 1.821.976 | 5 | 1:09:36 |
| Wikipedia | 659.388 | 16.582.426 | 6 | 3:39:23 |
| Volljahr ISI 2004 | 849.888 | 5.843.729 | 7 | 3:40:23 |

*Verschiedene Datensätze, die zur Benchmarkierung von Standardparametern für die mehrstufige Version von OpenOrd verwendet wurden, sind in der ersten Spalte aufgeführt. Die zweite und dritte Spalte enthalten die Datensatzgröße, die vierte Spalte enthält die verwendete Ebene, und die fünfte Spalte zeigt die Zeit, die auf einer Workstation benötigt wurde (Stunden:Minuten:Sekunden).*

## 5. SCHLUSSFOLGERUNGEN

In diesem Paper haben wir eine Sammlung von Algorithmen (OpenOrd) dokumentiert, die zum Zeichnen großer Graphen verfügbar sind. Der Fokus dieser Algorithmen liegt auf realen Datensätzen, wie sie beispielsweise in wissenschaftlicher Literatur und biologischen Anwendungen auftreten. Unser Ansatz basiert auf dem kraftgerichteten Ansatz von Frutcherman-Reingold. Dieser Ansatz wurde durch simuliertes Annealing und gitterbasierte Berechnung verfeinert, um einen praktischen Algorithmus zu erhalten, der nachweislich gut auf realen Datensätzen funktioniert. Allerdings erzeugt der Algorithmus visuell unattraktive und global ungenaue Layouts für große Datensätze. Wir haben das Problem der visuellen Attraktivität durch Kantenschneiden und das Problem der globalen Ungenauigkeit durch einen mehrstufigen Ansatz mit Average-Link-Clustering zur Erfassung realer globaler Strukturen angegangen.

Wir haben das Verhalten von OpenOrd an verschiedenen Datensätzen demonstriert, einschließlich Hefe-Mikroarray-Daten, wissenschaftlichen Zeitschriftendaten, wissenschaftlichen Literaturdaten und Wikipedia-Artikeln. Wir haben geeignete Standardparameter bestimmt, die auf unterschiedlich großen Datensätzen verwendet werden können, und haben diese Standardwerte in unserem Open-Source-Code bereitgestellt, der unter www.cs.sandia.gov/~smartin verfügbar ist. Schließlich wurde der Algorithmus für die Verwendung auf parallelen Computern für extrem große Datensätze angepasst.

## DANKSAGUNGEN

Die Autoren danken B. Herr et al. für die Bereitstellung der Wikipedia-Artikeldaten. Sandia ist ein Multiprogramm-Labor, das von der Sandia Corporation, einem Unternehmen von Lockheed Martin, für das Energieministerium der Vereinigten Staaten unter Vertrag DE-AC04-94AL85000 betrieben wird. Diese Arbeit wurde durch Sandias Computer Science Research Fund unterstützt.

## LITERATURVERZEICHNIS

1. Battista, G. D., Eades, P., Tamassia, R., and Tollis, I. G., *Graph Drawing Algorithms for the Visualization of Graphs*, Prentice Hall (1999).

2. Jünger, M. and Mutzel, P., *Graph Drawing Software*, Springer-Verlag (2004).

3. Freeman, L. C., "Visualizing social networks," *Journal of Social Structure* 1(1) (2000).

4. Börner, K., Chen, C., and Boyack, K., "Visualizing knowledge domains," in *Annual Review of Information Science and Technology*, Cronin, B., ed., 37, ch. 5, 179–255, American Society for Information Science and Technology, Medford, NJ (2003).

5. Shiffrin, R. and Börner, K., "Mapping knowledge domains," *Proc. Natl. Acad. Sci.* 101 suppl. 1, 5183–5185 (2004).

6. Wolff, A., "Drawing subway maps: A survey," *Informatik - Forschung und Entwicklung* 22, 23–44 (2007).

7. Wiese, K. C. and Eicher, C., "Graph drawing tools for bioinformatics research: An overview," in *CBMS '06: Proceedings of the 19th IEEE Symposium on Computer-Based Medical Systems*, 653–658, IEEE Computer Society, Washington, DC, USA (2006).

8. Adai, A. T., Date, S. V., Wieland, S., and Marcotte, E. M., "LGL: Creating a map of protein function with an algorithm for visualizing very large biological networks," *Journal of Molecular Biology* 340, 179–190 (2004).

9. Eades, P., "A heuristic for graph drawing," *Congressus Numerantium* 42, 149–160 (1984).

10. Kamada, T. and Kawai, S., "An algorithm for drawing general undirected graphs," *Information Processing Letters* 31, 7–15 (1989).

11. Frutcherman, T. and Reingold, E., "Graph drawing by force-directed placement," *Software-Practice and Experience* 21, 1129–1164 (1991).

12. Davidson, R. and Harel, D., "Drawing graphs nicely using simulated annealing," *ACM Trans. on Graphics* 15, 301–331 (1996).

13. Walshaw, C., "A multilevel algorithm for force-directed graph-drawing," *Journal of Graph Algorithms and Applications* 7(3), 253–285 (2003).

14. Harel, D. and Koren, Y., "A fast multi-scale method for drawing large graphs," *Journal of Graph Algorithms and Applications* 6, 179–202 (2002).

15. Hachul, S. and Jünger, M., "Drawing large graphs with a potential-field-based multilevel algorithm," in *Graph Drawing*, Pach, J., ed., 285–295, Springer Berlin (2005).

16. Hu, Y. F., "Efficient and high quality force-directed graph drawing," *The Mathematica Journal* 10, 37–71 (2005).

17. Quigley, A. and Eades, P., "Fade: Graph drawing, clustering, and visual abstraction," in *Graph Drawing*, Marks, J., ed., 197–210, Springer Berlin (2001).

18. Noack, A., "An energy model for visual graph clustering," in *Graph Drawing*, Liotta, G., ed., 425–436, Springer Berlin (2004).

19. Frishman, Y. and Tal, A., "Multi-level graph layout on the gpu," *IEEE Transactions on Visualization and Computer Graphics* 13, 1310–1319 (2007).

20. Godiyal, A., Hoberock, J., Garland, M., and Hart, J. C., "Rapid multipole graph drawing on the gpu," in *Graph Drawing*, Tollis, I. G. and Patrignani, M., eds., 90–101, Springer Berlin (2009).

21. Davidson, G., Hendrickson, B., Johnson, D., Meyers, C., and Wylie, B., "Knowledge mining with VxInsight: Discovery through interaction," *Journal of Intelligent Information Systems* 11, 259–285 (1998).

22. Davidson, G., Wylie, B., and Boyack, K., "Cluster stability and the use of noise in interpretation of clustering," in *IEEE Symposium on Information Visualization (INFOVIS)*, 23–30 (2001).

23. Boyack, K., Wylie, B., and Davidson, G., "Domain visualization using VxInsight for science and technology management," *Journal of the American Society for Information Science and Technology* 53(9), 74–774 (2002).

24. Boyack, K., "Mapping knowledge domains: Characterizing PNAS," *Proc. Natl. Acad. Sci.* 101 suppl. 1, 5192–5199 (2004).

25. Boyack, K., Klavans, R., and Börner, K., "Mapping the backbone of science," *Scientometrics* 64(3), 351–374 (2005).

26. Kim, S., Lund, J., Kiraly, M., Duke, K., Jiang, M., Stuart, J., Eizinger, A., Wylie, B., and Davidson, G., "A gene expression map for Caenorhabditis elegans," *Science* 293(5537), 2087–2092 (2001).

27. Werner-Washburne, M., Wylie, B., Boyack, K., Fuge, E., Galbraith, J., Weber, J., and Davidson, G., "Comparative analysis of multiple genome-scale data sets," *Genome Research* 12(10), 1564–1573 (2002).

28. Wilson, C., Davidson, G., Martin, S., Andries, E., Potter, J., Harvey, R., Ar, K., Xu, Y., Kopecky, K., Ankerst, D., Gundacker, H., Slovak, M., Mosquera-Caro, M., Chen, I.-M., Stirewalt, D., Murphy, M., Schultz, F., Kang, H., Wang, X., Radich, J., Appelbaum, F., Atlas, S., Godwin, J., and Willman, C., "Gene expression profiling of adult acute myeloid leukemia identifies novel biologic clusters for risk classification and outcome prediction," *Blood* 108, 685–696 (2006).

29. Tenenbuam, J. B., de Silva, V., and Langford, J. C., "A global geometric framework for nonlinear dimensionality reduction," *Science* 290, 2319–2323 (2000).

30. Roweis, S. and Saul, L., "Nonlinear dimensionality reduction by locally linear embedding," *Science* 290, 2323–2326 (2000).

31. Davidson, G., Martin, S., Boyack, K., Wylie, B., Martinez, J., Aragon, A., Werner-Washburne, M., Mosquera-Caro, M., and Willman, C., "Robust methods in microarray analysis," in *Genomics and Proteomics Engineering in Medicine and Biology*, Akay, M., ed., 99–130, Wiley IEEE (2007).

32. Hendrickson, B. and Leland, R., "A multilevel algorithm for partitioning graphs," in *Proc. Supercomputing '95, San Diego*, ACM Press (1995).

33. King, B., "Step-wise clustering procedures," *J. Am. Stat. Assoc.* 69, 86–101 (1967).

34. Jain, A. K., Murty, M. N., and Flynn, P. J., "Data clustering: A review," *ACM Computing Surveys* 31(3), 264–323 (1999).

35. Spellman, P. T., Sherlock, G., Zhang, M. Q., Iyer, V. R., Anders, K., Eisen, M. B., Brown, P. O., Botstein, D., and Futcher, B., "Comprehensive identification of cell cycle-regulated genes of the yeast Saccharomyces cerevisiae by microarray hybridization," *Molecular Biology of the Cell* 9, 3273–3297 (1998).

36. Herr, B., Holloway, T., and Börner, K., "An emergent mosaic of Wikipedian activity." *International Workshop and Conference on Network Science* (2007).

37. Boyack, K., "Using detailed maps of science to identify potential collaborations," *Scientometrics* 79, 27–44 (2009).

38. Boyack, K., Tsao, J., Miksovic, A., and Huey, M., "A recursive process for mapping and clustering literatures: International trends in solid state lighting," *International Journal of Technology Transfer and Commercialization* 8, 51–87 (2009).

39. Ben-Hur, A., Elisseeff, A., and Guyon, I., "A stability based method for discovering structure in clustered data," in *Pacific Symposium on Biocomputing*, 6–17 (2002).
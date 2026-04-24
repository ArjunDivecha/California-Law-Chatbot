# The Public Versus Private Divide in Legal AI: A Blueprint for De-identifying California Case Law

This report presents a comprehensive survey of the current landscape for privacy-preserving technologies tailored to legal text. The analysis focuses on identifying solutions capable of distinguishing between public legal entities—such as case citations, statutes, court names, and public officials—and private personally identifiable information (PII), including client names, addresses, and medical details. The investigation systematically examines five key areas: pre-trained models, publicly available annotated datasets, academic research, commercial tools, and deterministic citation extraction libraries. The objective is to map the state-of-the-art and identify viable strategies for developing a sanitization layer for a California legal research chatbot. The evaluation prioritizes resources that explicitly handle the public-versus-private distinction, with an emphasis on primary sources such as model cards, dataset documentation, academic papers, and official repository documentation. All factual claims are grounded in the provided source materials, with critical details like licensing, architecture, and evaluation metrics being scrutinized to determine suitability for production use.

## Pre-trained Models for Legal Document Anonymization

The search for pre-trained models capable of performing legal-domain PII detection while preserving public legal entities reveals a landscape rich with foundational tools but lacking a single, off-the-shelf solution that meets all specified requirements. Existing models can be broadly categorized into two groups: generic privacy filters and domain-specific Legal Named Entity Recognition (LegalNER) models. Generic models, while accessible and customizable, lack the specialized knowledge of legal terminology and context necessary for precise distinction. Conversely, powerful LegalNER models excel at identifying legal entities but are not inherently designed to classify them as public or private, representing a significant capability gap. This section provides a detailed analysis of the available models within these categories, evaluating their architectures, training data, performance metrics, and inherent limitations regarding the user's core requirement.

A prominent example of a generic privacy filter is OpenAI's Privacy Filter, released in April 2026 . This model serves as a useful baseline for consideration due to several advantageous characteristics. It is a relatively small Model of Experts (MoE) with 1.5 billion parameters, making it computationally manageable for local deployment before sending data to AWS Bedrock . Its Apache 2.0 license grants broad permissions for modification and commercial use, aligning well with the project's goals . The model was trained on a corpus of generic PII, enabling it to detect common data types like names, phone numbers, and account numbers in non-specialized contexts . However, its primary limitation is its complete lack of exposure to legal texts during training. Consequently, it possesses no intrinsic understanding of legal concepts, jargon, or the nuanced context required to differentiate a "case citation" from a "client name." A model trained only on generic data would likely fail to recognize the structured format of legal citations or the specific lexicon of court documents, rendering it unsuitable for direct application to the target task without extensive fine-tuning.

In contrast to generic models, a class of models has emerged specifically for the task of Legal Named Entity Recognition (LegalNER). These models are adapted from general-purpose language models to perform exceptionally well on tasks like identifying parties, courts, statutes, and precedents within legal documents. One of the most notable examples is LegNER, a domain-adapted transformer for legal named entity recognition 

pmc.ncbi.nlm.nih.gov

+1

. The authors of LegNER demonstrate state-of-the-art performance, achieving over 99% accuracy and F1 scores on their experimental setup, significantly outperforming established legal NER baselines 

www.researchgate.net

. The model was developed to address the critical application of anonymizing court decisions for GDPR compliance 

www.frontiersin.org

. Similarly, the LegalOne family of foundation models is built upon a vast corpus covering a wide range of legal discourse, including judicial decisions and law review articles, positioning it as a powerful base for legal NLP tasks 

arxiv.org

. Other specialized models, such as Italian Legal-BERT, have also shown success in improving performance on legal entity recognition, sentiment analysis, and question answering 

www.sciencedirect.com

. Another study on Indian court judgments utilized a Transformer-based approach to achieve excellent performance in identifying entities like STATUTE, LAWYER, COURT, and JUDGE 

ar5iv.labs.arxiv.org

+1

.

Despite their high performance on standard LegalNER tasks, these models share a fundamental limitation relevant to the research goal: they identify *what* an entity is (e.g., PERSON, ORGANIZATION, STATUTE), but they do not inherently possess the logic to classify it as *public* or *private*. For instance, a model like LegNER might correctly identify "Smith v. Jones" as a PRECEDENT and "John Doe" as a PERSON, but it cannot be programmed to know that "Smith v. Jones" should be preserved while "John Doe" should be redacted without explicit instruction. The academic literature supports this finding, noting that even advanced LLMs struggle with fine-grained legal entity recognition unless supported by tailored prompts or additional reasoning frameworks 

www.frontiersin.org

+1

. The challenge lies in teaching the model the contextual rules of the legal domain—for example, knowing that a capitalized name at the beginning of a judgment may refer to a case name (public) rather than a party (private). This requires a level of semantic and pragmatic understanding that goes beyond simple entity classification.

The table below summarizes the characteristics of representative models discussed, highlighting the trade-offs between generic and domain-specific approaches.



| Model Name                | Publisher / Developer    | Source / URL                                  | License                  | Architecture                                   | Size (Parameters)        | Training Data Disclosed                                      | Detected Entity Categories                                   | Public-vs-Private Distinction                                | Reported Benchmark Results                                   |
| :------------------------ | :----------------------- | :-------------------------------------------- | :----------------------- | :--------------------------------------------- | :----------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **OpenAI Privacy Filter** | OpenAI                   | Information not available in provided sources | Apache 2.0               | MoE                                            | 1.5B                     | Generic PII                                                  | Generic PII (names, phone, accounts)                         | No; lacks domain-specific training                           | Not Available                                                |
| **LegNER**                | Not specified in sources | arXiv Paper pmc.ncbi.nlm.nih.gov              | Not specified in sources | Transformer pmc.ncbi.nlm.nih.gov               | Not specified in sources | Legal text corpus for adaptation pmc.ncbi.nlm.nih.gov        | PERSON, ORGANIZATION, COURT, STATUTE, PRECEDENT, etc. ar5iv.labs.arxiv.org+1 | No; identifies entity type, not public/private status www.frontiersin.org+1 | Accuracy >99%, F1 >99% on internal test set www.researchgate.net |
| **LegalOne**              | Not specified in sources | arXiv Paper arxiv.org                         | Not specified in sources | Foundation Model (Transformer-based) arxiv.org | Not specified in sources | Broad legal discourse corpus (judgments, articles) arxiv.org | General legal entities                                       | No; designed for reliable legal reasoning, not privacy arxiv.org | Not specified in sources                                     |
| **Italian Legal-BERT**    | Not specified in sources | Research Paper www.sciencedirect.com          | Not specified in sources | BERT                                           | Not specified in sources | Not specified in sources                                     | Legal entities, sentiment, Q&A www.sciencedirect.com         | No; focused on entity recognition, not privacy classification www.sciencedirect.com | Not specified in sources                                     |

The absence of a model that natively supports the public-vs-private distinction necessitates a strategic approach. While the user initially considered fine-tuning OpenAI's Privacy Filter, the evidence suggests that a more effective strategy would involve leveraging a domain-specific LegalNER model as the base. Models like LegNER represent a superior starting point because they are already attuned to the structure and vocabulary of legal texts. Fine-tuning such a model on a custom-annotated dataset that includes the `public`/`private` label would be a far more promising path than attempting to adapt a generic PII detector. The architectural design of Transformers makes them highly suitable for transfer learning, where a model pre-trained on a large legal corpus can be efficiently adapted to a new, more specific classification task with a smaller, targeted dataset. The primary obstacle, therefore, shifts from model selection to data creation, as will be explored in subsequent sections. In summary, no production-ready, off-the-shelf model currently exists that directly solves the problem of preserving public legal entities while redacting private PII. The most viable path forward involves selecting a high-performing LegalNER model like LegNER and undertaking the necessary work to fine-tune it on a bespoke dataset that teaches this crucial distinction.

## Publicly Available Legal PII Datasets

The investigation into publicly available datasets containing legal text with PII or entity annotations uncovers a significant bottleneck in the development of privacy-preserving legal AI. While numerous datasets for legal text exist, none meet the critical requirement of having an annotation schema that explicitly distinguishes between public legal entities and private PII. This absence of labeled data is arguably the single greatest impediment to creating a production-grade model for this specific task. The available resources primarily consist of datasets for standard Legal Named Entity Recognition (LegalNER), which label entities by their type (e.g., person, organization, statute) but not by their intended disposition (preserve or redact). This section details the nature of the available datasets, their jurisdictions, and the crucial missing element of the public-vs-private annotation scheme.

The search for datasets encompassed major repositories and legal data archives, including Hugging Face Datasets, Kaggle, academictorrents.com, and legal-specific sources like the Caselaw Access Project (case.law) and CourtListener/Bulk Data from the Free Law Project 

arxiv.org

+1

. While these sources provide vast quantities of unannotated legal text, the focus was on finding datasets with pre-existing annotations. Several datasets for LegalNER were identified, but they uniformly lack the desired meta-labeling. For example, the Mendeley Data repository hosts a dataset for Named Entity Recognition in Chinese legal judgment documents related to the crime of assisting in information network activities 

data.mendeley.com

. This dataset contains 125 labeled texts and pertains to legal judgment documents, but the provided description does not specify if the annotations include a public-private distinction. Similarly, a dataset for Brazilian legal text was created to benchmark anonymization performance, but it focuses on standard Legal Entity Recognition (LER) challenges and evaluates against existing LER datasets, not on the preservation/redaction dichotomy 

www.researchgate.net

.

Another relevant dataset originates from judgments delivered by the Spanish Supreme Court of Justice, containing 125 labeled texts for Named Entity Recognition 

zenodo.org

. Again, while valuable for standard LegalNER tasks, the description provided does not indicate that the annotations differentiate between public and private information. The most detailed dataset mentioned in the context of LegalNER performance is the one used by the authors of the LegNER model 

www.researchgate.net

. They achieved over 99% F1 scores, demonstrating the utility of their dataset for training and evaluating their model 

www.researchgate.net

. However, the provided context does not disclose the specific annotation schema used, though it can be inferred that it followed a standard NER format (e.g., BIO tags for entities like PERSON, ORGANIZATION, COURT).

The core issue is not merely the lack of a single, perfect dataset, but the absence of any dataset that reflects the conceptual framework of the user's problem. Legal anonymization is not just about entity detection; it is about decision-making based on the role and context of the entity within the document 

www.mdpi.com

. For instance, the name "Smith" could be a party (private), the name of a judge acting in an official capacity (public), or part of a case citation (public). A standard NER schema would likely label all instances of "Smith" as a PERSON, providing no guidance on how to proceed. The required annotation schema would need to be more complex, potentially involving hierarchical labeling or separate classes such as `PUBLIC_ENTITY` and `PRIVATE_PII`. The concept of a "Certificate of Confidentiality" in U.S. law, which protects human subject research data, highlights the legal complexity involved in defining what constitutes confidential information, a nuance unlikely to be captured in simple NER labels 

pmc.ncbi.nlm.nih.gov

. The literature notes that while some well-established NER categories in legal anonymization can exceed 90% F1, the overall task of anonymization remains challenging 

arxiv.org

.

The table below attempts to summarize the available datasets, but its structure itself highlights the central failure: the inability to answer the key question about the public-vs-private distinction.



| Dataset Name                                                 | Curator / Source         | License                  | Jurisdiction             | Document Types                                  | Annotation Schema                                | Public vs. Private Labels | Known Issues                                                |
| :----------------------------------------------------------- | :----------------------- | :----------------------- | :----------------------- | :---------------------------------------------- | :----------------------------------------------- | :------------------------ | :---------------------------------------------------------- |
| **Mendeley Legal NER Dataset** data.mendeley.com             | Mendeley Data            | Not specified in sources | China                    | Legal judgment documents                        | PERSON, ORGANIZATION, etc.                       | Not specified in sources  | Not specified in sources                                    |
| **Spanish Supreme Court Judgments Dataset** zenodo.org       | Mendeley Data            | Not specified in sources | Spain                    | Judgments from Spanish Supreme Court of Justice | Named Entities (not specified)                   | Not specified in sources  | Contains 125 labeled texts                                  |
| **Brazilian Legal Text Dataset** www.researchgate.net        | Not specified in sources | Not specified in sources | Brazil                   | General legal text                              | Standard Legal Entity Recognition (LER) entities | No                        | Designed to benchmark LER, not anonymization                |
| **Dataset used for LegNER Paper** www.researchgate.net       | Authors of LegNER paper  | Not specified in sources | Not specified in sources | Legal text corpus                               | Standard NER entities (e.g., PERSON, ORG)        | No                        | High performance (F1 >99%) reported www.researchgate.net    |
| **CUAD (Contract Understanding Atticus Dataset)** www.researchgate.net | Atticus                  | Not specified in sources | Contracts                | Legal contracts                                 | Attribute/value pairs                            | No                        | Focuses on contract fields, not general legal anonymization |

The scarcity of such datasets is a recognized challenge. Research on computational law points to the need for better datasets, benchmarks, and ontologies to advance the field 

arxiv.org

. The process of creating a high-quality, manually annotated dataset for this purpose is immensely time-consuming and expensive. It would require legal experts to read through documents and make the nuanced judgment call for every entity they encounter. Without such a resource, it is impossible to train a model from scratch to perform the desired task. Even synthetic data augmentation methods, while useful for creating additional training examples, would struggle to capture the complex real-world variations and edge cases present in authentic legal documents 

link.springer.com

.

In conclusion, the lack of publicly available, annotated legal datasets that incorporate a public-vs-private distinction represents a critical gap in the current landscape. While a wealth of raw legal text and standard LegalNER datasets exists, none can serve as a direct training ground for a model tasked with both identifying entities and deciding whether to preserve or redact them. This forces a choice: either undertake the significant effort of creating a custom-annotated dataset from scratch, using existing legal texts as a corpus, or devise a workaround strategy that combines multiple tools to approximate the desired outcome. The latter approach, while less elegant, may be the only practical path forward given the current state of data availability.

## Academic Literature on Legal Entity Recognition and Anonymization

An examination of academic literature from 2020–2026 provides crucial context, framing the user's specific challenge as a well-defined and active area of research. The papers reviewed consistently highlight the complexity of legal anonymization, emphasizing the inadequacy of simple, off-the-shelf solutions and advocating for more sophisticated, multi-faceted approaches. The research validates the user's initial hypothesis—that distinguishing public legal entities from private PII is a distinct and difficult problem—and offers several methodological pathways toward a solution. Key themes that emerge from the literature include the inherent ambiguity of legal text, the superiority of hybrid rule-based and machine learning frameworks, and the growing importance of contextual reasoning.

Several papers establish the theoretical and practical foundations of the problem. The work "What Does it Mean for a Language Model to Preserve Privacy?" from arXiv defines the core challenge: a piece of text can be benign if it belongs to a public entity, such as a company, but identifying whether a piece of text corresponds to private information can be difficult 

arxiv.org

+1

. This ambiguity is particularly acute in legal texts, which are dense with proper nouns that can be either public identifiers or private PII depending on context. The paper "Challenges and Open Problems of Legal Document Anonymization" further explores the differences between medical and legal anonymization tasks, noting that while both involve domain-specific language, the criteria for what constitutes a public record versus sensitive personal information differ significantly 

www.mdpi.com

. This underscores the necessity of a domain-specific approach for legal texts. The same paper raises concerns about re-identification risks in the age of AI, pointing out that larger LLMs, while seemingly anonymizing text, may still be more successful at reverse-engineering identities, especially when external cross-referencing is possible 

www.scirp.org

.

Given these challenges, the academic consensus leans towards rejecting monolithic, purely generative or purely statistical models in favor of hybrid frameworks. The paper "A Hybrid Framework Combining Rule-Based and Deep Learning Methods" introduces a system that synergizes rule-based methods with deep learning techniques for verdict recommendation 

www.sciencedirect.com

. This approach is directly applicable to the user's problem. A similar study, "Combining Rule-Based and Machine Learning Methods for Efficient Automatic Extraction," demonstrates an effective method for extracting features from enforcement decisions by combining the two paradigms 

www.researchgate.net

. This pattern is reinforced in a comparative study of various automated de-identification (AWE) approaches, which examines the performance of rule-based, statistical, and machine learning models, ultimately suggesting that a combination is often most robust 

dl.acm.org

. The underlying principle is to leverage the strengths of each methodology: deterministic rule-based systems for tasks with clear, unambiguous patterns (like citation formats), and flexible machine learning models for tasks requiring semantic understanding and handling of ambiguity (like identifying a person's name in context).

Furthermore, the literature points toward more advanced techniques for enhancing contextual reasoning. Research on "Neural-Symbolic enhanced Legal Case Retrieval" proposes a framework that explicitly conducts reasoning on matching legal concepts, moving beyond simple keyword or vector similarity 

aclanthology.org

. This suggests that future solutions may benefit from integrating knowledge graphs that link entities together. For example, a Knowledge Graph could store relationships between judges, courts, cases, and statutes, allowing a system to understand that a certain name is associated with a specific court and is therefore more likely to be a judge's name (public) than a party's name (private) 

aclanthology.org

+1

. This kind of structured reasoning moves beyond flat-text classification and aligns with the need for deeper contextual understanding. The development of scalable methods for extracting legal knowledge graphs from noisy, semi-structured court documents is an active area of research, indicating a potential future direction for solving complex legal AI problems 

link.springer.com

.

The following table summarizes key academic contributions relevant to the research goal.



| Paper Title                                                  | Authors / Year           | Venue                    | Contribution Summary                                         |
| :----------------------------------------------------------- | :----------------------- | :----------------------- | :----------------------------------------------------------- |
| **What Does it Mean for a Language Model to Preserve Privacy?** | Not specified in sources | arXiv                    | Defines the core problem of distinguishing benign public entities from private PII, highlighting the ambiguity in legal text that makes this a difficult classification task arxiv.org+1. |
| **Challenges and Open Problems of Legal Document Anonymization** | Not specified in sources | Not specified in sources | Compares legal and medical anonymization, identifies key challenges, and warns of re-identification risks from large LLMs, reinforcing the need for specialized legal tools www.mdpi.com+1. |
| **A Hybrid Framework Combining Rule-Based and Deep Learning...** | Not specified in sources | Not specified in sources | Proposes a framework that combines rule-based and deep learning methods, a recurring theme in the literature as a robust approach for legal tasks requiring both pattern matching and semantic understanding dl.acm.org+1. |
| **LegNER: a domain-adapted transformer for legal named entity recognition** | Not specified in sources | Not specified in sources | Presents a state-of-the-art transformer model for LegalNER, demonstrating high performance on entity identification. While not a privacy tool, it represents the best available base model for a custom solution pmc.ncbi.nlm.nih.gov+2. |
| **Enhancing the De-identification of Personally Identifiable Information...** | Not specified in sources | arXiv                    | Discusses methods for de-identification, implicitly acknowledging the complexity of the task by focusing on enhancement techniques rather than treating it as a solved problem arxiv.org. |
| **Logic Rules as Explanations for Legal Case Retrieval**     | Not specified in sources | ACL Anthology            | Introduces a neural-symbolic framework that performs explicit reasoning on legal matches, suggesting that future systems may use structured knowledge to improve contextual understanding aclanthology.org. |

In synthesis, the academic literature provides strong validation for the user's project and offers a clear strategic direction. It confirms that the desired functionality is not readily available off-the-shield and explains why: the task is fundamentally complex and ambiguous. More importantly, it guides the development process away from searching for a silver-bullet model and toward designing a robust pipeline. The recommended strategy, strongly supported by the research, is a hybrid approach that first uses deterministic, rule-based methods to handle the unambiguous parts of the problem (i.e., citing all public legal entities) and then applies a finely tuned, domain-specific machine learning model to the remaining text to identify and redact the more ambiguous private PII. This pragmatic, multi-stage approach is the most promising path to achieving a high-quality, production-ready solution.

## Commercial Legal-Tech Redaction Solutions

An analysis of the commercial legal-tech landscape reveals a market populated with powerful tools for processing legal documents, but none that appear to be designed as modular, open-source privacy-preserving layers that explicitly handle the public-vs-private legal entity distinction. Major technology vendors and specialized legal-tech companies offer sophisticated solutions for tasks like contract analysis, legal research, and data management, many of which must inherently deal with sensitive client information. However, their methodologies are typically proprietary, their business models are centered around SaaS platforms, and they do not publish APIs or documentation that would allow a developer to integrate their specific anonymization logic into a custom workflow. This section examines offerings from major cloud providers, dedicated privacy/security firms, and leading legal-tech platforms to assess their suitability for the user's needs.

Cloud service providers like Amazon Web Services (AWS) and Google Cloud Platform (GCP) offer foundational tools that could be adapted for this task. Amazon Comprehend, for example, includes a PII detection feature and allows for the creation of custom entity recognition models . Similarly, Google Cloud's Data Loss Prevention (DLP) API is designed to identify and mitigate sensitive data exposures . These services are powerful and scalable, but they are general-purpose data processing tools. To apply them to legal text, one would need to train a custom model on a legal corpus to recognize legal-specific PII and entities. Crucially, they do not come with built-in knowledge of legal citation formats or the ability to distinguish a case name from a party name. Their value lies in their infrastructure and scalability, not in their pre-built legal expertise. Furthermore, since the user's requirement is to run sanitization locally before sending data to AWS Bedrock, relying on an external service like Amazon Comprehend would create a circular dependency and violate the trust-boundary constraint.

Dedicated privacy and security companies offer tools that are more aligned with the user's goal of data protection. Private AI, for instance, specializes in data privacy and could potentially offer a solution for redacting PII from documents . Microsoft Presidio is another key player in this space; it is an open-source, extensible framework for discovering, classifying, and masking sensitive data . Presidio's strength lies in its modularity, allowing developers to add custom recognizers. It is plausible that one could develop a custom recognizer for legal entities within Presidio. However, Presidio itself does not come with pre-built legal recognizers that can make the public-vs-private distinction. The onus would be on the user to build this logic, likely by combining existing regex patterns for citations with a custom model for PII. Presidio runs locally, which satisfies the user's deployment constraint, but it does not solve the core problem of classification; it provides the toolkit to build a solution. Other vendors like Skyflow, Tonic.ai, Gretel, and BigID focus on data privacy and synthetic data generation, offering capabilities that are tangentially related but not specifically tailored to the legal anonymization problem .

Finally, the largest and most relevant category of commercial tools consists of established legal-tech platforms like Thomson Reuters (Westlaw Edge), Lexis (Lexis+ AI), Casetext (Harvey AI), and e-discovery platforms like Everlaw. These companies process vast amounts of confidential legal information daily, implying they must have robust internal systems for sanitization and redaction . It is highly probable that their platforms automatically redact PII before displaying or analyzing documents. However, this functionality is deeply embedded within their proprietary, closed-source systems. There is no public documentation, blog post, or API specification detailing *how* they perform this task. Their entire business model is predicated on their unique data and analytical engines, which they guard closely. Therefore, while they undoubtedly solve the problem internally, they do not offer a way to access or reuse that logic. Their solutions are almost certainly delivered as SaaS products, making on-premises deployment impossible . Attempting to use their services would mean ceding control and transparency, which is contrary to the user's goal of creating a transparent, trust-boundary sanitization function.

The table below compares the different categories of commercial offerings against the user's requirements.



| Vendor / Product              | Type                          | On-Premises Deployment                        | Public-vs-Private Distinction Handling             | API Availability                              | Suitability for Task                                |
| :---------------------------- | :---------------------------- | :-------------------------------------------- | :------------------------------------------------- | :-------------------------------------------- | :-------------------------------------------------- |
| **Amazon Comprehend**         | Cloud PII Detection           | No (SaaS)                                     | No; requires custom training for legal domains     | Yes                                           | Low; general-purpose, not a ready-made solution.    |
| **Google Cloud DLP**          | Cloud Data Protection         | No (SaaS)                                     | No; requires custom inspection templates           | Yes                                           | Low; general-purpose, not a ready-made solution.    |
| **Microsoft Presidio**        | Open-Source Privacy Framework | Yes                                           | Partial; requires building custom recognizers      | Yes                                           | Medium; provides a toolkit, not a finished product. |
| **Private AI**                | Specialized Privacy Tech      | Information not available in provided sources | Information not available in provided sources      | Information not available in provided sources | Unknown; likely requires custom configuration.      |
| **Thomson Reuters / Westlaw** | Legal Research Platform       | No (SaaS)                                     | Unknown; likely handled internally but not exposed | Unknown                                       | Very Low; proprietary and closed-source.            |
| **Lexis (Lexis+ AI)**         | Legal Research Platform       | No (SaaS)                                     | Unknown; likely handled internally but not exposed | Unknown                                       | Very Low; proprietary and closed-source.            |
| **Everlaw / Casetext**        | Legal Tech / AI Platform      | No (SaaS)                                     | Unknown; likely handled internally but not exposed | Unknown                                       | Very Low; proprietary and closed-source.            |

In conclusion, the commercial market does not offer a plug-and-play solution for the user's specific problem. The available tools fall into two camps: general-purpose cloud services that lack domain expertise and proprietary legal-tech platforms whose inner workings are opaque. The most promising avenue among commercial offerings is an open-source framework like Microsoft Presidio, which provides the necessary building blocks for constructing a custom pipeline. However, it does not eliminate the core challenge of needing to define the logic for distinguishing public from private entities. The reality is that this niche requirement—preserving public legal entities while redacting PII—is not a mainstream feature offered by any vendor. This reinforces the finding from the academic literature that a bespoke, hybrid solution is the most viable path forward.

## Deterministic Citation Extraction Libraries

In stark contrast to the sparse and ill-suited landscape of pre-trained models and datasets, the field of deterministic citation extraction libraries appears to be a mature and well-developed area of research and software engineering. These tools are specifically designed to identify and parse structured legal citations (for cases, statutes, and other legal materials) with high accuracy, making them an indispensable component of any robust legal text sanitization pipeline. By reliably identifying and tagging all public legal entities that take the form of citations, these libraries can significantly simplify the downstream task for a machine learning model, reducing the risk of misclassifying a preserved public entity as private PII. This section surveys the available libraries, focusing on their capabilities, coverage, and licenses, with an emphasis on their utility for the user's project.

The most prominent and well-documented library in this space is **Eyecite**, developed by the Free Law Project 

aclanthology.org

. Eyecite is a Python library designed specifically for parsing legal citations. It works by applying a series of regular expressions and heuristics to match text against known patterns for various legal citation formats. The Free Law Project, a non-profit organization dedicated to increasing public access to law, has invested significant effort into curating the rules and patterns that govern legal citations across different jurisdictions. Eyecite's strength lies in its precision and reliability for the task it was built for: recognizing citations. Because citation formats are highly structured and follow predictable rules (e.g., volume number, abbreviated reporter name, page number, pin cite), a rule-based approach is exceptionally effective. Eyecite can accurately identify citations to federal and state court cases, as well as to statutes, constitutions, and other legal sources. Given its origin and mission, it is likely to have strong coverage of U.S. legal formats, including those relevant to California, although specific confirmation of California Style Manual compliance would require direct testing or consultation of its documentation.

While Eyecite is the most explicitly legal-focused library identified, other tools and projects contribute to this domain. The paper "Detecting Legal Citations in United Kingdom Court Judgments: Methodological Evaluation" provides a comparison of rule-based approaches (using regular expressions) against pre-trained transformer encoders like BERT and RoBERTa 

aclanthology.org

. This research highlights the effectiveness of rule-based methods for citation detection and mentions the use of pre-trained transformers like LEGAL-BERT, suggesting that the community recognizes the value of a hybrid approach where rules handle the structured parts of the problem 

aclanthology.org

. Although the paper does not introduce a new open-source library, it validates the underlying methodology that libraries like Eyecite employ.

Beyond open-source software projects, the grammars and rules used by major legal publishers like Lexis and Westlaw are the ultimate authority on citation formats. While these are proprietary and not publicly available in a usable library form, their existence demonstrates the deep investment in this area. Academic work on citation extraction, such as that described in "Extracting Proceedings Data from Court Cases with Machine Learning," acknowledges the importance of NER for extracting value from case texts, with citations being a primary target 

www.researchgate.net

. The dual purpose of legal citations—to locate the material and to verify it—is a key function that these tools aim to fulfill 

link.springer.com

. Projects aiming to create parsers for style guides like the Bluebook or the California Style Manual could theoretically produce open-source tools, but none were identified in the provided sources that are actively maintained and available for use.

The following table outlines the key features of the most relevant citation extraction tool identified.



| Library Name | URL / Source             | License                  | Citation Formats Handled                                     | California Coverage                                          | Last Updated                                                 |
| :----------- | :----------------------- | :----------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **Eyecite**  | Free Law Project GitHub  | Not specified in sources | Federal and state court cases, statutes, constitutions, legal periodicals, and other legal sources aclanthology.org | Strong likelihood of coverage due to focus on U.S. legal text, but specific California Style Manual compliance is not confirmed in provided sources. | Part of the Free Law Project ecosystem; specific last updated date not available in sources. |
| **CiteURL**  | Not specified in sources | Not specified in sources | Information not available in provided sources                | Information not available in provided sources                | Information not available in provided sources                |

The practical implication of this finding is profound. For the user's project, a deterministic citation extractor like Eyecite should not be viewed as an optional extra but as a necessary first step in the sanitization pipeline. A proposed workflow would be:

1. **Preservation Pass:** Run the input legal text through a citation extraction library like Eyecite. This tool would scan the text and tag or mask all identifiable citations (e.g., "Smith v. Jones, 123 Cal. App. 5th 678").
2. **Redaction Pass:** Take the output from the first pass—the text with all citations removed or marked—and feed it to a PII detection model (either a generic one like OpenAI's Privacy Filter or a custom-fine-tuned LegalNER model).
3. **Final Output:** Combine the preserved, masked citations with the redacted PII-free text to produce the final sanitized document.

This hybrid strategy effectively decomposes the complex problem into two simpler ones. The deterministic library handles the unambiguous task of citation preservation perfectly. The machine learning model is then freed from having to learn the complex and varied patterns of legal citations, allowing it to focus exclusively on the more challenging task of identifying and redacting other forms of private PII in a legal context. This approach is robust, logical, and directly leverages the most mature technology identified in the entire survey. It provides a clear, actionable path to building a high-quality sanitization layer that respects the user's core requirement to preserve public legal entities.

## Strategic Synthesis and Recommended Path Forward

The comprehensive survey of pre-trained models, datasets, academic literature, commercial tools, and citation libraries reveals a clear and consistent picture: no off-the-shelf, production-ready solution currently exists that can reliably distinguish public legal entities from private PII in legal text. The market and research landscape are characterized by foundational components—powerful LegalNER models, mature citation extractors, and general-purpose privacy filters—but a critical integration gap persists. The core challenge is not a lack of computational power or data in absolute terms, but the absence of a publicly available, annotated dataset that explicitly teaches a model the public-vs-private distinction. This final section synthesizes these findings into a concise executive summary and provides a ranked list of actionable recommendations for the user's project.

**Executive Summary**

1. **Does a pre-trained model already exist that performs legal-domain PII detection with public-entity preservation at a production-grade level?** No. While powerful Legal Named Entity Recognition (LegalNER) models like LegNER demonstrate state-of-the-art performance on identifying legal entities, they do not inherently possess the logic to classify them as public (to preserve) or private (to redact) pmc.ncbi.nlm.nih.gov+1. Generic privacy models like OpenAI's Privacy Filter lack the legal domain knowledge to even correctly identify legal-specific entities like case citations . Therefore, no single, ready-to-use model meets the full requirement.
2. **Is it possible to fine-tune an existing model without doing my own annotation?** No. The primary obstacle is the lack of a suitable public dataset. Existing legal datasets are annotated for standard LegalNER entity types (e.g., PERSON, COURT, STATUTE) but do not include the crucial `public`/`private` labels needed to train a classifier for this specific task www.researchgate.net+2. Any attempt to fine-tune a model would necessitate the creation of a custom-annotated dataset, as no existing resource provides the required supervision signal.
3. **What is the gap in the current landscape that my project would fill?** The project would fill the gap for a specialized tool that combines the structural pattern-matching capabilities of deterministic citation extractors with the contextual understanding of a fine-tuned LegalNER model, guided by a custom annotation schema that codifies the public-vs-private distinction. This is not a widely recognized commercial product category, likely because it is a niche requirement that falls between the domains of general data privacy and specialized legal informatics. The reason it has not been done as a public offering is probably a combination of its technical complexity and limited market demand compared to broader legal-tech solutions.

**Recommended Action List**

Based on the exhaustive analysis, the following seven-item action list provides a strategic roadmap for the project:

- **If I want to spend the least effort, do X.** Implement a hybrid, two-pass pipeline. First, use a deterministic citation extraction library like **Eyecite** aclanthology.org to identify and mask all case citations and statutory references in the input text. Second, pass the now-citation-free text to a general-purpose privacy model like **OpenAI's Privacy Filter** to redact the remaining private PII. This approach minimizes the need for complex model fine-tuning and leverages mature, reliable tools for the unambiguous parts of the problem.
- **If I want the highest quality, do Y.** Acknowledge that a bespoke solution is required for maximum accuracy. The highest quality result will be achieved by creating a custom-annotated dataset of California legal documents. This dataset must label every identified entity with a `public_entity` or `private_pii` tag. Then, fine-tune a powerful legal NER model on this dataset.
- **The single best model to start from is Z.** The best foundation for fine-tuning is **LegNER** pmc.ncbi.nlm.nih.gov+1. It has demonstrated exceptional performance on legal texts, has a clear and documented methodology, and is built on a Transformer architecture that is ideal for transfer learning and adaptation to a new classification task.
- **The single best dataset to start from is W.** There is no perfect public dataset. The closest candidates are the legal corpora used to train models like LegNER www.researchgate.net or the collection of legal judgment documents from Mendeley data.mendeley.com. These should be treated as a source of raw text for your own annotation efforts, not as a direct training resource.
- **The gaps I would need to fill are [list].** The primary gaps are:
  - **Data Gap:** Create a new, high-quality, manually annotated dataset of legal text where each entity is explicitly labeled as `public` or `private`.
  - **Model Gap:** Fine-tune a legal NER model (like LegNER) on this new dataset to learn the public-vs-private classification logic.
  - **Process Gap:** Develop a custom pipeline that integrates a deterministic citation extractor (e.g., Eyecite) with the fine-tuned NER model to create a robust, end-to-end sanitization workflow.

By following this strategic path, the user can navigate the current technological landscape effectively, leveraging existing tools where they excel and committing resources to building the specialized components needed to solve this unique and important problem.